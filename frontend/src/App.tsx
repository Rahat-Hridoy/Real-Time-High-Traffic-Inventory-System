/**
 * App.tsx
 * Root component. Responsibilities:
 *  1. Hold the authenticated user state (persisted in localStorage).
 *  2. Render <Toaster> once for the whole app.
 *  3. Gate-keep: show LoginPage or DashboardPage based on auth state.
 *  4. Delegate ALL business logic to useInventory hook.
 */

import React, { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { useInventory, loadUserFromStorage, persistUser, clearUser } from './hooks/useInventory';
import { apiLoginUser } from './lib/api';
import type { AppUser } from './types';

// ─── Toast theme ─────────────────────────────────────────────────────────────
const TOAST_STYLE = {
  background: '#1e293b',
  color: '#f1f5f9',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<AppUser | null>(loadUserFromStorage);

  // All inventory state lives in this hook
  const inventory = useInventory(user);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleLogin = useCallback(async (username: string) => {
    try {
      const userData = await apiLoginUser(username);
      persistUser(userData);
      setUser(userData);
      toast.success(`Welcome, ${userData.username}!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed. Try again.');
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearUser();
    setUser(null);
    toast.success('Signed out successfully.');
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: TOAST_STYLE }} />

      {!user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <DashboardPage
          user={user}
          drops={inventory.drops}
          reservations={inventory.reservations}
          socketConnected={inventory.socketConnected}
          reservingDropId={inventory.reservingDropId}
          purchasingResId={inventory.purchasingResId}
          stockPulseId={inventory.stockPulseId}
          isLoadingDrops={inventory.isLoadingDrops}
          onRefreshDrops={inventory.refreshDrops}
          onReserve={inventory.reserve}
          onPurchase={inventory.purchase}
          onReservationExpired={inventory.markExpired}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
