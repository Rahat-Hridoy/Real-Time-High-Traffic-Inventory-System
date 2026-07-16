/**
 * hooks/useSocket.ts
 * Manages the Socket.io lifecycle and exposes the connection status and emitters.
 */

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../constants';

interface StockUpdatePayload {
  dropId: number;
  availableStock: number;
  status: 'default' | 'pending' | 'completed' | 'expired';
  recentBuyers?: { username: string }[];
}

interface UseSocketOptions {
  onStockUpdate: (payload: StockUpdatePayload) => void;
}

export function useSocket({ onStockUpdate }: UseSocketOptions): {
  connected: boolean;
} {
  const [connected, setConnected] = useState(false);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL);
    setSocketInstance(socket);

    socket.on('connect', () => {
      console.log('[SOCKET] Connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected');
      setConnected(false);
    });

    socket.on('stock_update', (payload: StockUpdatePayload) => {
      console.log('[SOCKET] stock_update →', payload);
      onStockUpdate(payload);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connected };
}
