import { Router, Request, Response, NextFunction } from 'express';
import sequelize from '../../config/db';
import { Drop, Reservation } from '../../models';
import { Transaction } from 'sequelize';

const router = Router();

router.post('/reserve', async (req: Request, res: Response, next: NextFunction) => {
  const { userId, dropId } = req.body;

  if (!userId || !dropId) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'userId and dropId are required.' });
  }

  console.log(`[RESERVE] Start reservation request: user=${userId}, drop=${dropId}`);

  // Open transaction
  const transaction = await sequelize.transaction();
  console.log(`[RESERVE][TX:${transaction.id}] Transaction started.`);

  try {
    // 1. Set Row Level Security (RLS) context in the session
    console.log(`[RESERVE][TX:${transaction.id}] Setting session user context to ${userId}`);
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId: userId.toString() },
      transaction,
      logging: false // Keep logs focused
    });

    // 2. Query target Drop using Pessimistic Lock (SELECT ... FOR UPDATE)
    console.log(`[RESERVE][TX:${transaction.id}] Querying Drop ID ${dropId} with FOR UPDATE lock...`);
    const drop = await Drop.findByPk(dropId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!drop) {
      console.log(`[RESERVE][TX:${transaction.id}] Drop ID ${dropId} not found. Rolling back.`);
      await transaction.rollback();
      return res.status(404).json({ error: 'DROP_NOT_FOUND', message: 'The requested drop does not exist.' });
    }

    console.log(`[RESERVE][TX:${transaction.id}] Acquired lock on Drop ID ${dropId}. Current available stock: ${drop.available_stock}`);

    // 3. Validate stock levels
    if (drop.available_stock < 1) {
      console.log(`[RESERVE][TX:${transaction.id}] Stock depleted (available=${drop.available_stock}). Throwing OUT_OF_STOCK and rolling back.`);
      await transaction.rollback();
      return res.status(400).json({ error: 'OUT_OF_STOCK', message: 'This item is out of stock.' });
    }

    // 4. Decrement available stock
    drop.available_stock -= 1;
    await drop.save({ transaction });
    console.log(`[RESERVE][TX:${transaction.id}] Decremented stock by 1. New stock: ${drop.available_stock}`);

    // 5. Create PENDING reservation record
    const expiresAt = new Date(Date.now() + 60000); // Expires in 60 seconds
    const reservation = await Reservation.create({
      user_id: Number(userId),
      drop_id: Number(dropId),
      status: 'PENDING',
      expires_at: expiresAt
    }, { transaction });

    console.log(`[RESERVE][TX:${transaction.id}] Created pending reservation ID ${reservation.id} expiring at ${expiresAt.toISOString()}`);

    // Commit transaction
    await transaction.commit();
    console.log(`[RESERVE][TX:${transaction.id}] Transaction committed successfully.`);

    return res.status(201).json({
      success: true,
      message: 'Reservation completed successfully.',
      reservation: {
        id: reservation.id,
        user_id: reservation.user_id,
        drop_id: reservation.drop_id,
        status: reservation.status,
        expires_at: reservation.expires_at
      },
      available_stock: drop.available_stock
    });

  } catch (error: any) {
    // Safely rollback
    console.error(`[RESERVE][TX:${transaction.id}] Error encountered during reservation:`, error.message);
    
    try {
      await transaction.rollback();
      console.log(`[RESERVE][TX:${transaction.id}] Transaction rolled back safely.`);
    } catch (rollbackError: any) {
      console.error(`[RESERVE][TX:${transaction.id}] Failed to rollback transaction:`, rollbackError.message);
    }

    // Handle foreign key constraint error (e.g. invalid user ID)
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ error: 'USER_NOT_FOUND', message: 'The specified user does not exist.' });
    }

    return res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
  }
});

export default router;
