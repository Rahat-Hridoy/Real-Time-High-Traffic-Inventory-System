import { Router, Request, Response, NextFunction } from 'express';
import sequelize from '../../config/db';
import { Drop, Reservation, User, Purchase } from '../../models';
import { Transaction, Op } from 'sequelize';
import { broadcastStockUpdate } from '../socket';

const router = Router();

async function getRecentBuyersForDrop(dropId: number): Promise<{ username: string }[]> {
  const recentPurchases = await Purchase.findAll({
    where: { drop_id: dropId },
    order: [['created_at', 'DESC']],
    limit: 3,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['username']
      }
    ]
  });
  return recentPurchases.map(p => ({
    username: (p as any).user?.username || 'Anonymous'
  }));
}

router.post('/reserve', async (req: Request, res: Response, next: NextFunction) => {
  const { userId, dropId } = req.body;

  if (!userId || !dropId) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'userId and dropId are required.' });
  }

  console.log(`[RESERVE] Start reservation request: user=${userId}, drop=${dropId}`);

  // Open transaction
  const transaction = await sequelize.transaction();
  console.log(`[RESERVE][TX:${(transaction as any).id}] Transaction started.`);

  try {
    // 1. Set Row Level Security (RLS) context in the session
    console.log(`[RESERVE][TX:${(transaction as any).id}] Setting session user context to ${userId}`);
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId: userId.toString() },
      transaction,
      logging: false // Keep logs focused
    });

    // 2. Query target Drop using Pessimistic Lock (SELECT ... FOR UPDATE)
    console.log(`[RESERVE][TX:${(transaction as any).id}] Querying Drop ID ${dropId} with FOR UPDATE lock...`);
    const drop = await Drop.findByPk(dropId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!drop) {
      console.log(`[RESERVE][TX:${(transaction as any).id}] Drop ID ${dropId} not found. Rolling back.`);
      await transaction.rollback();
      return res.status(404).json({ error: 'DROP_NOT_FOUND', message: 'The requested drop does not exist.' });
    }

    console.log(`[RESERVE][TX:${(transaction as any).id}] Acquired lock on Drop ID ${dropId}. Current available stock: ${drop.available_stock}`);

    // 3. Validate stock levels
    if (drop.available_stock < 1) {
      console.log(`[RESERVE][TX:${(transaction as any).id}] Stock depleted (available=${drop.available_stock}). Throwing OUT_OF_STOCK and rolling back.`);
      await transaction.rollback();
      return res.status(400).json({ error: 'OUT_OF_STOCK', message: 'This item is out of stock.' });
    }

    // 4. Decrement available stock
    drop.available_stock -= 1;
    await drop.save({ transaction });
    console.log(`[RESERVE][TX:${(transaction as any).id}] Decremented stock by 1. New stock: ${drop.available_stock}`);

    // 5. Create PENDING reservation record
    const expiresAt = new Date(Date.now() + 60000); // Expires in 60 seconds
    const reservation = await Reservation.create({
      user_id: Number(userId),
      drop_id: Number(dropId),
      status: 'PENDING',
      expires_at: expiresAt
    }, { transaction });

    console.log(`[RESERVE][TX:${(transaction as any).id}] Created pending reservation ID ${reservation.id} expiring at ${expiresAt.toISOString()}`);

    // Commit transaction
    await transaction.commit();
    console.log(`[RESERVE][TX:${(transaction as any).id}] Transaction committed successfully.`);

    const recentBuyers = await getRecentBuyersForDrop(Number(dropId));

    // Broadcast updated stock count to all connected socket clients
    broadcastStockUpdate(Number(dropId), drop.available_stock, 'default', recentBuyers);

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
    console.error(`[RESERVE][TX:${(transaction as any).id}] Error encountered during reservation:`, error.message);
    
    try {
      await transaction.rollback();
      console.log(`[RESERVE][TX:${(transaction as any).id}] Transaction rolled back safely.`);
    } catch (rollbackError: any) {
      console.error(`[RESERVE][TX:${(transaction as any).id}] Failed to rollback transaction:`, rollbackError.message);
    }

    // Handle foreign key constraint error (e.g. invalid user ID)
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ error: 'USER_NOT_FOUND', message: 'The specified user does not exist.' });
    }

    return res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
  }
});

// 1. GET /api/drops - Fetch all drops
router.get('/drops', async (req: Request, res: Response) => {
  try {
    const drops = await Drop.findAll({ order: [['id', 'ASC']] });
    
    const dropsWithDetails = await Promise.all(drops.map(async (drop) => {
      const recentBuyers = await getRecentBuyersForDrop(drop.id);
      return {
        ...drop.toJSON(),
        status: 'default' as const,
        recentBuyers
      };
    }));

    return res.json(dropsWithDetails);
  } catch (error: any) {
    console.error('[GET_DROPS] Failed to fetch drops:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch drops.' });
  }
});

// 2. POST /api/purchase - Simulate completing a purchase using reservation
router.post('/purchase', async (req: Request, res: Response) => {
  const { reservationId, userId } = req.body;

  if (!reservationId || !userId) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'reservationId and userId are required.' });
  }

  console.log(`[PURCHASE] Start purchase request: user=${userId}, reservation=${reservationId}`);

  const transaction = await sequelize.transaction();
  console.log(`[PURCHASE][TX:${(transaction as any).id}] Transaction started.`);

  try {
    // Set RLS context in session
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId: userId.toString() },
      transaction,
      logging: false
    });

    // Find the reservation
    const reservation = await Reservation.findByPk(reservationId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!reservation) {
      console.log(`[PURCHASE][TX:${(transaction as any).id}] Reservation ID ${reservationId} not found (or restricted by RLS). Rolling back.`);
      await transaction.rollback();
      return res.status(404).json({ error: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });
    }

    if (reservation.status !== 'PENDING') {
      console.log(`[PURCHASE][TX:${(transaction as any).id}] Reservation status is ${reservation.status} (expected PENDING). Rolling back.`);
      await transaction.rollback();
      return res.status(400).json({ error: 'INVALID_RESERVATION_STATUS', message: `Reservation is already ${reservation.status}.` });
    }

    if (new Date() > new Date(reservation.expires_at)) {
      console.log(`[PURCHASE][TX:${(transaction as any).id}] Reservation expired. Rolling back.`);
      await transaction.rollback();
      return res.status(400).json({ error: 'RESERVATION_EXPIRED', message: 'Reservation has expired.' });
    }

    // Set reservation to COMPLETED
    reservation.status = 'COMPLETED';
    await reservation.save({ transaction });

    // Create a Purchase record
    const purchase = await Purchase.create({
      user_id: Number(userId),
      drop_id: reservation.drop_id
    }, { transaction });

    await transaction.commit();
    console.log(`[PURCHASE][TX:${(transaction as any).id}] Transaction committed. Purchase ID: ${purchase.id}`);

    // Fetch updated stock level, status, and recent buyers
    const drop = await Drop.findByPk(reservation.drop_id);
    const availableStock = drop ? drop.available_stock : 0;
    const recentBuyers = await getRecentBuyersForDrop(reservation.drop_id);

    broadcastStockUpdate(reservation.drop_id, availableStock, 'default', recentBuyers);

    return res.status(201).json({
      success: true,
      message: 'Purchase completed successfully.',
      purchase: {
        id: purchase.id,
        user_id: purchase.user_id,
        drop_id: purchase.drop_id,
        createdAt: purchase.createdAt
      }
    });

  } catch (error: any) {
    console.error(`[PURCHASE][TX:${(transaction as any).id}] Error encountered during purchase:`, error.message);
    try {
      await transaction.rollback();
    } catch (rollbackError: any) {
      console.error(`[PURCHASE][TX:${(transaction as any).id}] Rollback failed:`, rollbackError.message);
    }
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
  }
});

// 3. POST /api/users - Create or retrieve a user by username
router.post('/users', async (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'username is required.' });
  }

  try {
    const [user] = await User.findOrCreate({
      where: { username }
    });
    return res.status(200).json(user);
  } catch (error: any) {
    console.error('[POST_USERS] Error creating user:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create or retrieve user.' });
  }
});

// 4. GET /api/reservations - Fetch reservations for a user (respects RLS)
router.get('/reservations', async (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'userId query parameter is required.' });
  }

  const transaction = await sequelize.transaction();
  try {
    // Set RLS context in session
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId: userId.toString() },
      transaction,
      logging: false
    });

    const reservations = await Reservation.findAll({
      order: [['id', 'DESC']],
      transaction
    });

    await transaction.commit();
    return res.json(reservations);
  } catch (error: any) {
    console.error('[GET_RESERVATIONS] Failed to fetch reservations:', error);
    try {
      await transaction.rollback();
    } catch (e) {}
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch reservations.' });
  }
});

// 5. POST /api/cancel-reservation - Release reservation and increment stock back
router.post('/cancel-reservation', async (req: Request, res: Response) => {
  const { reservationId, userId } = req.body;

  if (!reservationId || !userId) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'reservationId and userId are required.' });
  }

  console.log(`[CANCEL] Start cancel request: user=${userId}, reservation=${reservationId}`);

  const transaction = await sequelize.transaction();
  console.log(`[CANCEL][TX:${(transaction as any).id}] Transaction started.`);

  try {
    // Set RLS context in session
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId: userId.toString() },
      transaction,
      logging: false
    });

    // Find the reservation
    const reservation = await Reservation.findByPk(reservationId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!reservation) {
      console.log(`[CANCEL][TX:${(transaction as any).id}] Reservation ID ${reservationId} not found (or restricted by RLS). Rolling back.`);
      await transaction.rollback();
      return res.status(404).json({ error: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });
    }

    if (reservation.status !== 'PENDING') {
      console.log(`[CANCEL][TX:${(transaction as any).id}] Reservation status is ${reservation.status} (expected PENDING). Rolling back.`);
      await transaction.rollback();
      return res.status(400).json({ error: 'INVALID_RESERVATION_STATUS', message: `Reservation is already ${reservation.status}.` });
    }

    // Set reservation to EXPIRED
    reservation.status = 'EXPIRED';
    await reservation.save({ transaction });

    // Reclaim stock: Find the corresponding Drop
    const drop = await Drop.findByPk(reservation.drop_id, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!drop) {
      console.log(`[CANCEL][TX:${(transaction as any).id}] Drop ID ${reservation.drop_id} not found. Rolling back.`);
      await transaction.rollback();
      return res.status(404).json({ error: 'DROP_NOT_FOUND', message: 'The requested drop does not exist.' });
    }

    drop.available_stock += 1;
    await drop.save({ transaction });
    console.log(`[CANCEL][TX:${(transaction as any).id}] Restored stock for Drop ID ${drop.id}. New stock: ${drop.available_stock}`);

    await transaction.commit();
    console.log(`[CANCEL][TX:${(transaction as any).id}] Transaction committed.`);

    // Fetch updated stock level and recent buyers
    const availableStock = drop.available_stock;
    const recentBuyers = await getRecentBuyersForDrop(reservation.drop_id);

    broadcastStockUpdate(reservation.drop_id, availableStock, 'default', recentBuyers);

    return res.status(200).json({
      success: true,
      message: 'Reservation cancelled successfully.',
      reservation: {
        id: reservation.id,
        user_id: reservation.user_id,
        drop_id: reservation.drop_id,
        status: reservation.status
      },
      available_stock: availableStock
    });

  } catch (error: any) {
    console.error(`[CANCEL][TX:${(transaction as any).id}] Error encountered during reservation cancellation:`, error.message);
    try {
      await transaction.rollback();
    } catch (rollbackError: any) {
      console.error(`[CANCEL][TX:${(transaction as any).id}] Rollback failed:`, rollbackError.message);
    }
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
  }
});

export default router;
