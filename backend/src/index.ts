import http from 'http';
import app from './server';
import sequelize from '../config/db';
import dotenv from 'dotenv';
import path from 'path';
import { initSocket } from './socket';
import { startStockRecoveryWorker } from './worker';

// Load environmental variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[SERVER] Authenticating database connection...');
    await sequelize.authenticate();
    console.log('[SERVER] Database connection verified successfully.');

    const server = http.createServer(app);

    // Initialize Socket.io
    initSocket(server);

    // Start background stock recovery worker
    startStockRecoveryWorker();

    server.listen(PORT, () => {
      console.log(`[SERVER] Running with Socket.io on http://localhost:${PORT}`);
    });
  } catch (error: any) {
    console.error('[SERVER] Failed to start server due to database connection error:', error.message);
    process.exit(1);
  }
}

startServer();
