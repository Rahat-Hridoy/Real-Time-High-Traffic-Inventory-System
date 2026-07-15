import app from '../src/server';
import sequelize from '../config/db';
import { User, Drop, Reservation } from '../models';
import http from 'http';

const PORT = 5055;

async function runTest() {
  console.log('[BACKEND CHECK] Starting Stage 2 Concurrency & Pessimistic Locking Test...');

  // 1. Authenticate and Sync
  try {
    await sequelize.authenticate();
    console.log('[BACKEND CHECK] Database connected.');
  } catch (err: any) {
    console.error('[BACKEND CHECK] Database connection failed:', err.message);
    process.exit(1);
  }

  // 2. Start local server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`[BACKEND CHECK] Test server listening on http://localhost:${PORT}`);
      resolve();
    });
  });

  try {
    // 3. Setup test data (we clear any previous test users/drops to keep it clean)
    console.log('[BACKEND CHECK] Preparing test database records...');
    
    // We do cleanups in a transaction to preserve FK constraints
    const setupTx = await sequelize.transaction();
    
    // Create test users
    const userA = await User.create({ username: 'stage2_user_A' }, { transaction: setupTx });
    const userB = await User.create({ username: 'stage2_user_B' }, { transaction: setupTx });
    
    // Create test drop with exactly 1 available stock
    const drop = await Drop.create({
      name: 'Limited Stock Drop',
      price: 299.99,
      total_stock: 1,
      available_stock: 1
    }, { transaction: setupTx });
    
    await setupTx.commit();

    console.log(`[BACKEND CHECK] Created User A (ID: ${userA.id}), User B (ID: ${userB.id})`);
    console.log(`[BACKEND CHECK] Created Drop (ID: ${drop.id}) with available_stock = 1`);

    // 4. Send concurrent requests
    console.log('\n[BACKEND CHECK] Sending two concurrent reservation requests at the exact same time...');
    
    const requestA = fetch(`http://localhost:${PORT}/api/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userA.id, dropId: drop.id })
    }).then(async (r) => ({ name: 'Request A (User A)', status: r.status, body: await r.json() }));

    const requestB = fetch(`http://localhost:${PORT}/api/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userB.id, dropId: drop.id })
    }).then(async (r) => ({ name: 'Request B (User B)', status: r.status, body: await r.json() }));

    // Run simultaneously
    const results = await Promise.all([requestA, requestB]);

    console.log('\n[BACKEND CHECK] Concurrent request results received:');
    
    let successCount = 0;
    let outOfStockCount = 0;

    results.forEach((res) => {
      console.log(`\n--- Result for ${res.name} ---`);
      console.log(`HTTP Status: ${res.status}`);
      console.log(`Response Body:`, JSON.stringify(res.body, null, 2));

      if (res.status === 201 && res.body.success) {
        successCount++;
      } else if (res.status === 400 && res.body.error === 'OUT_OF_STOCK') {
        outOfStockCount++;
      }
    });

    console.log('\n[BACKEND CHECK] Asserting results...');
    console.log(`[BACKEND CHECK] Successful reservations: ${successCount} (Expected: 1)`);
    console.log(`[BACKEND CHECK] Out of Stock rejections: ${outOfStockCount} (Expected: 1)`);

    // Verify DB stock level
    const updatedDrop = await Drop.findByPk(drop.id);
    console.log(`[BACKEND CHECK] Available stock in database: ${updatedDrop?.available_stock} (Expected: 0)`);

    // Verify Reservations created
    // Since we want to bypass RLS to read all reservations for validation, we query using an admin transaction with no RLS or let the owner bypass it
    // Wait, the test script runs as neondb_owner, which bypasses RLS, so we can read all reservations!
    const reservations = await Reservation.findAll({ where: { drop_id: drop.id } });
    console.log(`[BACKEND CHECK] Number of reservation records in DB: ${reservations.length} (Expected: 1)`);
    if (reservations.length > 0) {
      console.log(`[BACKEND CHECK] Reservation details: ID=${reservations[0].id}, UserID=${reservations[0].user_id}, Status=${reservations[0].status}`);
    }

    if (successCount === 1 && outOfStockCount === 1 && updatedDrop?.available_stock === 0 && reservations.length === 1) {
      console.log('\n[BACKEND CHECK] CONCURRENCY & LOCKING VERIFICATION PASSED SUCCESSFULLY! 🚀');
    } else {
      console.error('\n[BACKEND CHECK] CONCURRENCY & LOCKING VERIFICATION FAILED! ❌');
    }

    // 5. Cleanup test data
    console.log('\n[BACKEND CHECK] Cleaning up test data...');
    const cleanupTx = await sequelize.transaction();
    await Reservation.destroy({ where: { drop_id: drop.id }, transaction: cleanupTx });
    await Drop.destroy({ where: { id: drop.id }, transaction: cleanupTx });
    await User.destroy({ where: { id: [userA.id, userB.id] }, transaction: cleanupTx });
    await cleanupTx.commit();
    console.log('[BACKEND CHECK] Cleanup completed.');

  } catch (error: any) {
    console.error('[BACKEND CHECK] Test encountered an unexpected error:', error);
  } finally {
    // Shutdown server
    server.close(() => {
      console.log('[BACKEND CHECK] Test server shutdown.');
      sequelize.close().then(() => {
        console.log('[BACKEND CHECK] Database connection closed. Exiting.');
        process.exit(0);
      });
    });
  }
}

runTest();
