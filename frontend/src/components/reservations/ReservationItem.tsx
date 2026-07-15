/**
 * components/reservations/ReservationItem.tsx
 * Single reservation card shown in the sidebar panel.
 */

import React from 'react';
import { ShoppingCart, CheckCircle, XCircle, Loader2, Play } from 'lucide-react';
import CountdownTimer from '../ui/CountdownTimer';
import type { Drop, Reservation } from '../../types';

interface Props {
  res: Reservation;
  drops: Drop[];
  isPurchasing: boolean;
  onPurchase: () => void;
  onExpire: () => void;
}

const STATUS_STYLES: Record<Reservation['status'], string> = {
  PENDING:   'bg-amber-950/10 border-amber-900/30 pulsing-border',
  COMPLETED: 'bg-emerald-950/20 border-emerald-900/40',
  EXPIRED:   'bg-slate-900/30 border-slate-800/50 opacity-60',
};

const STATUS_BADGE: Record<Reservation['status'], string> = {
  PENDING:   'bg-amber-400/10 text-amber-400 animate-pulse',
  COMPLETED: 'bg-emerald-400/10 text-emerald-400',
  EXPIRED:   'bg-slate-800 text-slate-500',
};

const ReservationItem: React.FC<Props> = ({ res, drops, isPurchasing, onPurchase, onExpire }) => {
  const relatedDrop = drops.find(d => d.id === res.drop_id);
  const dropName    = relatedDrop ? relatedDrop.name : `Drop #${res.drop_id}`;

  return (
    <div className={`rounded-2xl p-4 border transition-all ${STATUS_STYLES[res.status]}`}>
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold text-slate-400">RES #{res.id}</span>
        </div>
        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg ${STATUS_BADGE[res.status]}`}>
          {res.status}
        </span>
      </div>

      {/* ── Drop name & expiry ── */}
      <p className="text-sm font-semibold text-slate-200 truncate mb-0.5">{dropName}</p>
      <p className="text-[11px] text-slate-500 mb-3">
        Expires: {new Date(res.expires_at).toLocaleTimeString()}
      </p>

      {/* ── PENDING: countdown + purchase button ── */}
      {res.status === 'PENDING' && (
        <div className="flex flex-col gap-2">
          <CountdownTimer expiresAt={res.expires_at} status={res.status} onExpire={onExpire} />
          <button
            disabled={isPurchasing}
            onClick={onPurchase}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 disabled:opacity-60 disabled:cursor-wait"
          >
            {isPurchasing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3 h-3" />}
            <span>Complete Purchase</span>
          </button>
        </div>
      )}

      {/* ── COMPLETED ── */}
      {res.status === 'COMPLETED' && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
          <CheckCircle className="w-3.5 h-3.5" />
          Purchased &amp; Secured
        </div>
      )}

      {/* ── EXPIRED ── */}
      {res.status === 'EXPIRED' && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
          <XCircle className="w-3.5 h-3.5" />
          Lock Expired — Stock Released
        </div>
      )}
    </div>
  );
};

export default ReservationItem;
