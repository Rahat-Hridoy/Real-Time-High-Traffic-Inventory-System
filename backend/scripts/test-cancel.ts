import sequelize from '../config/db';
import { User, Drop, Reservation } from '../models';

async function testCancelFlow() {
  console.log('\n[BACKEND CHECK] ==========================================');
  console.log('[BACKEND CHECK] STARTING CANCELLATION FLOW VERIFICATION...');
  console.log('[BACKEND CHECK] ==========================================\n');

  try {
    await sequelize.authenticate();
    console.log('[BACKEND CHECK] Database connected.');

    // 1. Prepare test records
    const [testUser] = await User.findOrCreate({
      where: { username: 'Cancel_Tester' }
    });
    console.log(`[BACKEND CHECK] Test User: ID=${testUser.id}, Username=${testUser.username}`);

    const [testDrop] = await Drop.findOrCreate({
      where: { name: 'Cancel Test Sneaker' },
      defaults: {
        name: 'Cancel Test Sneaker',
        price: 120.00,
        total_stock: 10,
        available_stock: 10
      }
    });
    const initialStock = testDrop.available_stock;
    console.log(`[BACKEND CHECK] Test Drop: ID=${testDrop.id}, Stock=${initialStock}`);

    // 2. Reserve
    console.log('[BACKEND CHECK] Reserving drop...');
    const txReserve = await sequelize.transaction();
    let reservationId: number | null = null;
    try {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId: testUser.id.toString() },
        transaction: txReserve
      });

      const dropForLock = await Drop.findByPk(testDrop.id, {
        transaction: txReserve,
        lock: txReserve.LOCK.UPDATE
      });

      if (!dropForLock || dropForLock.available_stock < 1) {
        throw new Error('Drop not found or out of stock.');
      }

      dropForLock.available_stock -= 1;
      await dropForLock.save({ transaction: txReserve });

      const expiresAt = new Date(Date.now() + 60000);
      const resRecord = await Reservation.create({
        user_id: testUser.id,
        drop_id: testDrop.id,
        status: 'PENDING',
        expires_at: expiresAt
      }, { transaction: txReserve });

      await txReserve.commit();
      reservationId = resRecord.id;
      console.log(`[BACKEND CHECK] Reservation created: ID=${resRecord.id}, Status=${resRecord.status}`);
      console.log(`[BACKEND CHECK] Stock decremented to ${dropForLock.available_stock}`);
    } catch (err: any) {
      await txReserve.rollback();
      console.error('[BACKEND CHECK] Reservation failed:', err.message);
      process.exit(1);
    }

    // 3. Now let's test cancellation logic (simulating the POST /api/cancel-reservation endpoint logic directly)
    console.log('[BACKEND CHECK] Executing cancellation logic...');
    const txCancel = await sequelize.transaction();
    try {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId: testUser.id.toString() },
        transaction: txCancel
      });

      const reservation = await Reservation.findByPk(reservationId, {
        transaction: txCancel,
        lock: txCancel.LOCK.UPDATE
      });

      if (!reservation || reservation.status !== 'PENDING') {
        throw new Error('Reservation not found or not pending.');
      }

      reservation.status = 'EXPIRED';
      await reservation.save({ transaction: txCancel });

      const drop = await Drop.findByPk(reservation.drop_id, {
        transaction: txCancel,
        lock: txCancel.LOCK.UPDATE
      });

      if (!drop) {
        throw new Error('Drop not found.');
      }

      drop.available_stock += 1;
      await drop.save({ transaction: txCancel });

      await txCancel.commit();
      console.log(`[BACKEND CHECK] Cancellation transaction committed successfully.`);
      console.log(`[BACKEND CHECK] Reservation status is now: ${reservation.status} (Expected: EXPIRED)`);
      console.log(`[BACKEND CHECK] Stock restored to: ${drop.available_stock} (Expected: ${initialStock})`);

      if (reservation.status === 'EXPIRED' && drop.available_stock === initialStock) {
        console.log('\n[BACKEND CHECK] ==========================================');
        console.log('[BACKEND CHECK] CANCELLATION FLOW VERIFICATION SUCCESSFUL!');
        console.log('[BACKEND CHECK] ==========================================\n');
      } else {
        console.error('[BACKEND CHECK] Verification failed: state does not match expectations.');
      }
    } catch (err: any) {
      await txCancel.rollback();
      console.error('[BACKEND CHECK] Cancellation failed:', err.message);
      process.exit(1);
    }

  } catch (error: any) {
    console.error('[BACKEND CHECK] Script error:', error.message);
  } finally {
    await sequelize.close();
  }
}

testCancelFlow();
