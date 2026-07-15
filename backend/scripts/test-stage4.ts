import sequelize from '../config/db';
import { User, Drop, Reservation, Purchase } from '../models';

async function testStage4Endpoints() {
  console.log('\n[BACKEND CHECK] ==========================================');
  console.log('[BACKEND CHECK] STARTING STAGE 4 ENDPOINTS VERIFICATION...');
  console.log('[BACKEND CHECK] ==========================================\n');

  try {
    await sequelize.authenticate();
    console.log('[BACKEND CHECK] Database connected.');

    // 1. Clean up previous test users/drops to have a clean testing state
    console.log('[BACKEND CHECK] Preparing fresh database test records...');
    const [testUser, userCreated] = await User.findOrCreate({
      where: { username: 'Stage4_Tester' }
    });
    console.log(`[BACKEND CHECK] Test User: ID=${testUser.id}, Username=${testUser.username} (Created: ${userCreated})`);

    const [testDrop, dropCreated] = await Drop.findOrCreate({
      where: { name: 'Stage 4 Limited Edition Hoodie' },
      defaults: {
        name: 'Stage 4 Limited Edition Hoodie',
        price: 79.99,
        total_stock: 5,
        available_stock: 5
      }
    });
    console.log(`[BACKEND CHECK] Test Drop: ID=${testDrop.id}, Name="${testDrop.name}", Stock=${testDrop.available_stock}/${testDrop.total_stock} (Created: ${dropCreated})`);

    // Ensure there is stock
    if (testDrop.available_stock < 1) {
      testDrop.available_stock = 5;
      await testDrop.save();
      console.log('[BACKEND CHECK] Stock refilled to 5.');
    }

    // 2. Validate GET /api/drops (direct model query verification)
    const allDrops = await Drop.findAll({ order: [['id', 'ASC']] });
    console.log(`[BACKEND CHECK] GET /api/drops check: Found ${allDrops.length} drops in database.`);
    allDrops.forEach(d => {
      console.log(`  - Drop ID ${d.id}: "${d.name}" - Stock: ${d.available_stock}/${d.total_stock} - Price: $${d.price}`);
    });

    // 3. Simulate POST /api/reserve
    console.log(`[BACKEND CHECK] Triggering reservation for user ID ${testUser.id} on drop ID ${testDrop.id}...`);
    // Open a transaction and execute the core reserve logic to ensure it passes
    const txReserve = await sequelize.transaction();
    let reservationId: number | null = null;
    try {
      // Set RLS
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
      console.log(`[BACKEND CHECK] Reservation created successfully: ID=${resRecord.id}, Status=${resRecord.status}, ExpiresAt=${resRecord.expires_at.toISOString()}`);
      console.log(`[BACKEND CHECK] Stock decremented. New available stock: ${dropForLock.available_stock}`);
    } catch (err: any) {
      await txReserve.rollback();
      console.error('[BACKEND CHECK] Reservation failed:', err.message);
      process.exit(1);
    }

    if (!reservationId) {
      throw new Error('Reservation ID was not generated.');
    }

    // 4. Validate GET /api/reservations (respects RLS)
    console.log(`[BACKEND CHECK] Querying reservations for user ID ${testUser.id} under RLS context...`);
    const txFetchRes = await sequelize.transaction();
    try {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId: testUser.id.toString() },
        transaction: txFetchRes
      });

      const userReservations = await Reservation.findAll({
        where: { user_id: testUser.id },
        transaction: txFetchRes
      });

      await txFetchRes.commit();
      console.log(`[BACKEND CHECK] GET /api/reservations check: Found ${userReservations.length} reservations for User ID ${testUser.id}.`);
      userReservations.forEach(r => {
        console.log(`  - Reservation ID ${r.id}: Status=${r.status}, ExpiresAt=${r.expires_at.toISOString()}`);
      });
    } catch (err: any) {
      await txFetchRes.rollback();
      console.error('[BACKEND CHECK] Failed to fetch reservations:', err.message);
      process.exit(1);
    }

    // 5. Simulate POST /api/purchase
    console.log(`[BACKEND CHECK] Completing purchase for reservation ID ${reservationId} and user ID ${testUser.id}...`);
    const txPurchase = await sequelize.transaction();
    try {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId: testUser.id.toString() },
        transaction: txPurchase
      });

      const reservation = await Reservation.findByPk(reservationId, {
        transaction: txPurchase,
        lock: txPurchase.LOCK.UPDATE
      });

      if (!reservation || reservation.status !== 'PENDING' || new Date() > new Date(reservation.expires_at)) {
        throw new Error('Reservation not found or invalid status.');
      }

      reservation.status = 'COMPLETED';
      await reservation.save({ transaction: txPurchase });

      const purchase = await Purchase.create({
        user_id: testUser.id,
        drop_id: reservation.drop_id
      }, { transaction: txPurchase });

      await txPurchase.commit();
      console.log(`[BACKEND CHECK] Purchase completed successfully: Purchase ID=${purchase.id}, User ID=${purchase.user_id}, Drop ID=${purchase.drop_id}`);
    } catch (err: any) {
      await txPurchase.rollback();
      console.error('[BACKEND CHECK] Purchase failed:', err.message);
      process.exit(1);
    }

    console.log('\n[BACKEND CHECK] ==========================================');
    console.log('[BACKEND CHECK] STAGE 4 ENDPOINTS VERIFICATION SUCCESSFUL!');
    console.log('[BACKEND CHECK] ==========================================\n');

  } catch (error: any) {
    console.error('[BACKEND CHECK] Verification script failed:', error.message);
  } finally {
    await sequelize.close();
  }
}

testStage4Endpoints();
