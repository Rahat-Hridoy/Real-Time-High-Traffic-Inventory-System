import app from '../src/server';
import sequelize from '../config/db';
import { User, Drop, Reservation } from '../models';
import http from 'http';
import { initSocket } from '../src/socket';
import { startStockRecoveryWorker, stopStockRecoveryWorker } from '../src/worker';
import { io as ioClient } from 'socket.io-client';

const PORT = 5056;

async function runTest() {
  console.log('[BACKEND CHECK] Starting Stage 3 Stock Recovery & Socket.io Real-Time Update Test...');

  // 1. Authenticate Database
  try {
    await sequelize.authenticate();
    console.log('[BACKEND CHECK] Database connected successfully.');
  } catch (err: any) {
    console.error('[BACKEND CHECK] Database connection failed:', err.message);
    process.exit(1);
  }

  // 2. Start server and bind Socket.io + Recovery Worker
  const server = http.createServer(app);
  initSocket(server);
  startStockRecoveryWorker(5000); // 5s check interval

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`[BACKEND CHECK] Test server listening on http://localhost:${PORT}`);
      resolve();
    });
  });

  // 3. Connect Socket.io client to listen for events
  const clientSocket = ioClient(`http://localhost:${PORT}`);
  const receivedEvents: any[] = [];

  clientSocket.on('stock_update', (data) => {
    console.log(`[CLIENT SOCKET] Received 'stock_update' event:`, data);
    receivedEvents.push(data);
  });

  await new Promise<void>((resolve) => {
    clientSocket.on('connect', () => {
      console.log(`[CLIENT SOCKET] Connected to testing server as ${clientSocket.id}`);
      resolve();
    });
  });

  let testUser: any = null;
  let testDrop: any = null;

  try {
    // 4. Setup test data (clean slate)
    console.log('[BACKEND CHECK] Preparing test data...');
    const setupTx = await sequelize.transaction();
    testUser = await User.create({ username: 'stage3_test_user' }, { transaction: setupTx });
    testDrop = await Drop.create({
      name: 'Stage 3 Test Item',
      price: 99.99,
      total_stock: 1,
      available_stock: 1
    }, { transaction: setupTx });
    await setupTx.commit();

    console.log(`[BACKEND CHECK] Created Test User (ID: ${testUser.id})`);
    console.log(`[BACKEND CHECK] Created Test Drop (ID: ${testDrop.id}) with available_stock = 1`);

    // 5. Call reservation endpoint
    console.log('[BACKEND CHECK] Sending reservation request...');
    const response = await fetch(`http://localhost:${PORT}/api/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: testUser.id, dropId: testDrop.id })
    });

    const resBody = await response.json();
    console.log(`[BACKEND CHECK] Reserve response (Status: ${response.status}):`, JSON.stringify(resBody, null, 2));

    if (response.status !== 201 || !resBody.success) {
      throw new Error('Reservation request failed, cannot proceed with recovery test.');
    }

    // Verify DB states immediately
    const immediateRes = await Reservation.findOne({ where: { drop_id: testDrop.id, user_id: testUser.id } });
    const immediateDrop = await Drop.findByPk(testDrop.id);

    console.log(`[BACKEND CHECK] Immediate DB Reservation status: ${immediateRes?.status} (Expected: PENDING)`);
    console.log(`[BACKEND CHECK] Immediate DB Drop available stock: ${immediateDrop?.available_stock} (Expected: 0)`);

    // 6. Wait for 65 seconds to allow expiration and recovery
    console.log('\n[BACKEND CHECK] Waiting 65 seconds for reservation to expire and recovery worker to reclaim stock...');
    const waitTime = 65;
    for (let i = 1; i <= waitTime; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (i % 5 === 0 || i === waitTime) {
        console.log(`[BACKEND CHECK] Waiting... ${waitTime - i} seconds remaining.`);
      }
    }

    // 7. Verify reservation status and stock recovery in DB
    console.log('\n[BACKEND CHECK] Verifying DB states after expiration...');
    const finalRes = await Reservation.findOne({ where: { drop_id: testDrop.id, user_id: testUser.id } });
    const finalDrop = await Drop.findByPk(testDrop.id);

    console.log(`[BACKEND CHECK] Final DB Reservation status: ${finalRes?.status} (Expected: EXPIRED)`);
    console.log(`[BACKEND CHECK] Final DB Drop available stock: ${finalDrop?.available_stock} (Expected: 1)`);

    // 8. Assert results
    const reservationExpired = finalRes?.status === 'EXPIRED';
    const stockRecovered = finalDrop?.available_stock === 1;

    // Check socket events
    const firstEvent = receivedEvents.find(e => e.dropId === testDrop.id && e.availableStock === 0);
    const secondEvent = receivedEvents.find(e => e.dropId === testDrop.id && e.availableStock === 1);

    console.log(`[BACKEND CHECK] Socket event 'stock = 0' received: ${!!firstEvent}`);
    console.log(`[BACKEND CHECK] Socket event 'stock = 1' received: ${!!secondEvent}`);

    if (reservationExpired && stockRecovered && firstEvent && secondEvent) {
      console.log('\n[BACKEND CHECK] STAGE 3 STOCK RECOVERY & SOCKET BROADCAST TEST PASSED SUCCESSFULLY! 🚀');
    } else {
      console.error('\n[BACKEND CHECK] STAGE 3 STOCK RECOVERY & SOCKET BROADCAST TEST FAILED! ❌');
    }

  } catch (error: any) {
    console.error('[BACKEND CHECK] Test error encountered:', error);
  } finally {
    // 9. Cleanup test data
    if (testDrop || testUser) {
      console.log('\n[BACKEND CHECK] Cleaning up test data...');
      try {
        const cleanupTx = await sequelize.transaction();
        if (testDrop) {
          await Reservation.destroy({ where: { drop_id: testDrop.id }, transaction: cleanupTx });
          await Drop.destroy({ where: { id: testDrop.id }, transaction: cleanupTx });
        }
        if (testUser) {
          await User.destroy({ where: { id: testUser.id }, transaction: cleanupTx });
        }
        await cleanupTx.commit();
        console.log('[BACKEND CHECK] Cleanup completed.');
      } catch (cleanupErr: any) {
        console.error('[BACKEND CHECK] Cleanup failed:', cleanupErr.message);
      }
    }

    // 10. Shutdown server and sockets
    console.log('[BACKEND CHECK] Shutting down socket client and test server...');
    clientSocket.disconnect();
    stopStockRecoveryWorker();
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
