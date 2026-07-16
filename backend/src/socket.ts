import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

/**
 * Initializes the Socket.io server and binds it to the HTTP server instance.
 */
export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Allow all origins for development and testing
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Returns the initialized Socket.io server instance.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
}

export interface RecentBuyer {
  username: string;
}

/**
 * Broadcasts the updated stock level of a drop to all connected clients.
 */
export function broadcastStockUpdate(
  dropId: number,
  availableStock: number,
  status: 'default' | 'pending' | 'completed' | 'expired' = 'default',
  recentBuyers?: RecentBuyer[]
): void {
  if (io) {
    console.log(`[SOCKET] Broadcasting stock update -> Drop ID: ${dropId}, Available Stock: ${availableStock}, Status: ${status}`);
    io.emit('stock_update', { dropId, availableStock, status, recentBuyers });
  } else {
    console.warn('[SOCKET] Broadcast failed: Socket.io is not initialized.');
  }
}

/**
 * Broadcasts a restock event to all connected clients.
 */
export function broadcastRestock(dropId: number, name: string): void {
  if (io) {
    console.log(`[SOCKET] Broadcasting restock -> Drop ID: ${dropId}, Name: ${name}`);
    io.emit('restock', { dropId, name });
  } else {
    console.warn('[SOCKET] Broadcast failed: Socket.io is not initialized.');
  }
}

