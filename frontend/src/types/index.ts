// ─── Domain Models ────────────────────────────────────────────────────────────

export interface Drop {
  id: number;
  name: string;
  price: number;
  total_stock: number;
  available_stock: number;
  createdAt: string;
  status?: 'default' | 'pending';
  recentBuyers?: { username: string }[];
}

export interface Reservation {
  id: number;
  user_id: number;
  drop_id: number;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  expires_at: string;
  createdAt?: string;
}

export interface AppUser {
  id: number;
  username: string;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface ReserveResponse {
  success: boolean;
  message?: string;
  reservation: Reservation;
  available_stock: number;
}

export interface PurchaseResponse {
  success: boolean;
  message?: string;
  purchase: { id: number; user_id: number; drop_id: number; createdAt: string };
}
