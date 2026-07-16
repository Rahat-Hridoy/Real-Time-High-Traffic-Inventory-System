/**
 * lib/api.ts
 * Centralised API layer — all backend fetch calls live here.
 * Components and hooks import from this file; never call fetch directly.
 */

import { BACKEND_URL } from '../constants';
import type { AppUser, Drop, Reservation, ReserveResponse, PurchaseResponse } from '../types';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data: T = await res.json();

  if (!res.ok) {
    const msg = (data as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ─── Drops ────────────────────────────────────────────────────────────────────

export async function apiGetDrops(): Promise<Drop[]> {
  return request<Drop[]>('/api/drops');
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function apiLoginUser(username: string): Promise<AppUser> {
  return request<AppUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function apiGetReservations(userId: number): Promise<Reservation[]> {
  return request<Reservation[]>(`/api/reservations?userId=${userId}`);
}

export async function apiReserveDrop(userId: number, dropId: number): Promise<ReserveResponse> {
  const res = await fetch(`${BACKEND_URL}/api/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, dropId }),
  });

  const data: ReserveResponse = await res.json();

  // 201 = success; anything else treat as a business-logic error (not a network throw)
  if (res.status !== 201) {
    throw new Error(data.message ?? 'Reservation failed.');
  }

  return data;
}

// ─── Purchases ────────────────────────────────────────────────────────────────

export async function apiPurchase(reservationId: number, userId: number): Promise<PurchaseResponse> {
  const res = await fetch(`${BACKEND_URL}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservationId, userId }),
  });

  const data: PurchaseResponse = await res.json();

  if (res.status !== 201) {
    throw new Error(data.message ?? 'Purchase failed.');
  }

  return data;
}

export async function apiCancelReservation(reservationId: number, userId: number): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/cancel-reservation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservationId, userId }),
  });

  const data = await res.json();

  if (res.status !== 200) {
    throw new Error(data.message ?? 'Cancellation failed.');
  }

  return data;
}
