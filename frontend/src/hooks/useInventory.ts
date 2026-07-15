/**
 * hooks/useInventory.ts
 * Master state-management hook for the dashboard.
 * Owns: drops, reservations, loading flags, and all action handlers.
 * Composes useSocket internally so the Dashboard page is pure-UI.
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from './useSocket';
import {
  apiGetDrops,
  apiGetReservations,
  apiReserveDrop,
  apiPurchase,
} from '../lib/api';
import { STORAGE_KEY_USER } from '../constants';
import type { Drop, Reservation, AppUser } from '../types';

interface UseInventoryReturn {
  // State
  drops: Drop[];
  reservations: Reservation[];
  reservingDropId: number | null;
  purchasingResId: number | null;
  stockPulseId: number | null;
  isLoadingDrops: boolean;
  socketConnected: boolean;

  // Actions
  refreshDrops: () => Promise<void>;
  reserve: (dropId: number) => Promise<Reservation | undefined>;
  purchase: (reservationId: number) => Promise<void>;
  markExpired: (reservationId: number) => void;
}

export function useInventory(user: AppUser | null): UseInventoryReturn {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservingDropId, setReservingDropId] = useState<number | null>(null);
  const [purchasingResId, setPurchasingResId] = useState<number | null>(null);
  const [stockPulseId, setStockPulseId] = useState<number | null>(null);
  const [isLoadingDrops, setIsLoadingDrops] = useState(true);

  // ── Socket.io ─────────────────────────────────────────────────────────────
  const handleStockUpdate = useCallback(
    ({
      dropId,
      availableStock,
      status,
      recentBuyers,
    }: {
      dropId: number;
      availableStock: number;
      status: 'default' | 'pending' | 'completed' | 'expired';
      recentBuyers?: { username: string }[];
    }) => {
      setDrops(prev =>
        prev.map(drop => {
          if (drop.id === dropId) {
            setStockPulseId(dropId);
            setTimeout(() => setStockPulseId(null), 1000);
            return {
              ...drop,
              available_stock: availableStock,
              status: (status === 'completed' || status === 'expired') ? 'default' : status,
              recentBuyers: recentBuyers || drop.recentBuyers,
            };
          }
          return drop;
        })
      );
    },
    []
  );

  const handleStockPending = useCallback(
    ({ dropId }: { dropId: number }) => {
      setDrops(prev =>
        prev.map(drop => {
          if (drop.id === dropId) {
            return { ...drop, status: 'pending' as const };
          }
          return drop;
        })
      );
    },
    []
  );

  const { connected: socketConnected, emitStockPending } = useSocket({
    onStockUpdate: handleStockUpdate,
    onStockPending: handleStockPending,
  });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const refreshDrops = useCallback(async () => {
    setIsLoadingDrops(true);
    try {
      setDrops(await apiGetDrops());
    } catch {
      toast.error('Could not load drops from server.');
    } finally {
      setIsLoadingDrops(false);
    }
  }, []);

  const fetchReservations = useCallback(async (userId: number) => {
    try {
      setReservations(await apiGetReservations(userId));
    } catch (err) {
      console.error('[useInventory] fetchReservations error:', err);
    }
  }, []);

  // Initial load
  useEffect(() => { refreshDrops(); }, [refreshDrops]);

  // Reload reservations when the logged-in user changes
  useEffect(() => {
    if (user) {
      fetchReservations(user.id);
    } else {
      setReservations([]);
    }
  }, [user, fetchReservations]);

  // ── Action handlers ───────────────────────────────────────────────────────
  const reserve = useCallback(
    async (dropId: number) => {
      if (!user) { toast.error('Please sign in first.'); return; }
      
      // Emit 'stock-pending' event via Socket.io instantly
      emitStockPending(dropId);
      
      // Locally update drop to pending instantly
      handleStockPending({ dropId });

      setReservingDropId(dropId);
      try {
        const data = await apiReserveDrop(user.id, dropId);
        toast.success('Item reserved! Secure it within 60 s.', { duration: 4000 });
        setReservations(prev => [data.reservation, ...prev]);
        return data.reservation;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Reservation failed.', { duration: 4000 });
        // Revert local pending if failed
        setDrops(prev =>
          prev.map(drop => {
            if (drop.id === dropId) {
              return { ...drop, status: 'default' as const };
            }
            return drop;
          })
        );
      } finally {
        setReservingDropId(null);
      }
    },
    [user, emitStockPending, handleStockPending]
  );

  const purchase = useCallback(
    async (reservationId: number) => {
      if (!user) return;
      setPurchasingResId(reservationId);
      try {
        await apiPurchase(reservationId, user.id);
        toast.success('Purchase complete! 🎉', { duration: 5000 });
        setReservations(prev =>
          prev.map(r => (r.id === reservationId ? { ...r, status: 'COMPLETED' as const } : r))
        );
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Purchase failed.');
        throw err;
      } finally {
        setPurchasingResId(null);
      }
    },
    [user]
  );

  const markExpired = useCallback((reservationId: number) => {
    setReservations(prev =>
      prev.map(r => {
        if (r.id === reservationId && r.status === 'PENDING') {
          toast.error(`Reservation #${reservationId} expired — stock released.`);
          return { ...r, status: 'EXPIRED' as const };
        }
        return r;
      })
    );
  }, []);

  return {
    drops,
    reservations,
    reservingDropId,
    purchasingResId,
    stockPulseId,
    isLoadingDrops,
    socketConnected,
    refreshDrops,
    reserve,
    purchase,
    markExpired,
  };
}

// ─── Auth helpers (used in App.tsx) ──────────────────────────────────────────

export function loadUserFromStorage(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function persistUser(user: AppUser): void {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY_USER);
}
