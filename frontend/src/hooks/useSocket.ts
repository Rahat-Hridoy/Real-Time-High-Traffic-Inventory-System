/**
 * hooks/useSocket.ts
 * Manages the Socket.io lifecycle and exposes the connection status.
 * The consumer passes a callback that fires whenever a stock_update arrives.
 */

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../constants';

interface StockUpdatePayload {
  dropId: number;
  availableStock: number;
}

interface UseSocketOptions {
  onStockUpdate: (payload: StockUpdatePayload) => void;
}

export function useSocket({ onStockUpdate }: UseSocketOptions): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(BACKEND_URL);

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
    // onStockUpdate is intentionally not in deps — callers should pass a stable ref
    // (or useCallback). Re-subscribing every render would reconnect the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return connected;
}
