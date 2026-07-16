// ─── API Base ─────────────────────────────────────────────────────────────────
// In production, VITE_API_URL is set to the Railway backend URL.
// Falls back to localhost:5000 for local development.
export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─── Login page sample accounts ──────────────────────────────────────────────
export const SAMPLE_CREDENTIALS = [
  { username: 'Alpha_Buyer', label: 'Alpha Buyer' },
  { username: 'Beta_Buyer',  label: 'Beta Buyer'  },
  { username: 'Gamma_Buyer', label: 'Gamma Buyer' },
  { username: 'Delta_Buyer', label: 'Delta Buyer' },
] as const;

// ─── Gradient accent classes for product cards (cycles by index) ──────────────
export const CARD_ACCENTS = [
  'from-purple-500 to-indigo-500',
  'from-pink-500 to-rose-500',
  'from-cyan-500 to-blue-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
] as const;

// ─── Local-storage keys ───────────────────────────────────────────────────────
export const STORAGE_KEY_USER = 'techzu_user';

// ─── Reservation timing ───────────────────────────────────────────────────────
/** Reservation window in seconds — must match backend (60 s). */
export const RESERVATION_WINDOW_S = 60;
