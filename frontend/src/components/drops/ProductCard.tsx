/**
 * components/drops/ProductCard.tsx
 * E-commerce-style card for a single Drop item.
 */

import React from 'react';
import { Plane, Tag, Sparkles, Loader2, XCircle } from 'lucide-react';
import type { Drop } from '../../types';

interface Props {
  drop: Drop;
  /** Tailwind gradient string e.g. "from-purple-500 to-indigo-500" */
  accentClass: string;
  isReserving: boolean;
  hasPulse: boolean;
  onReserve: () => void;
}

const ProductCard: React.FC<Props> = ({ drop, accentClass, isReserving, hasPulse, onReserve }) => {
  const isOutOfStock = drop.available_stock <= 0;
  const isLowStock   = !isOutOfStock && drop.available_stock <= 2;

  return (
    <article
      className={`product-card rounded-3xl overflow-hidden transition-all duration-300 ${
        hasPulse ? 'ring-2 ring-purple-500/40 shadow-xl shadow-purple-500/20' : ''
      }`}
    >
      {/* ── Hero / image area ── */}
      <div className={`relative h-44 bg-gradient-to-br ${accentClass} flex items-center justify-center overflow-hidden`}>
        {/* Subtle dot-grid overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 80%, white 1px, transparent 1px),' +
              'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        <Plane className="w-16 h-16 text-white/80 drop-shadow-lg -rotate-45" />

        {/* Stock status badge */}
        <span
          className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            isOutOfStock
              ? 'bg-rose-900/80 text-rose-300 border border-rose-700/50'
              : isLowStock
              ? 'bg-amber-900/80 text-amber-300 border border-amber-700/50 animate-pulse'
              : 'bg-emerald-900/80 text-emerald-300 border border-emerald-700/50'
          }`}
        >
          {isOutOfStock
            ? 'Sold Out'
            : isLowStock
            ? `Only ${drop.available_stock} left!`
            : 'In Stock'}
        </span>

        {/* Drop ID */}
        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/30 backdrop-blur-sm text-[10px] text-white/70 font-medium border border-white/10">
          #{drop.id}
        </span>
      </div>

      {/* ── Card body ── */}
      <div className="p-5">
        {/* Name & price */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-100 text-base leading-tight truncate">{drop.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Tag className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-500">Drop Item</span>
            </div>
          </div>
          <span className={`shrink-0 text-xl font-black bg-gradient-to-r ${accentClass} bg-clip-text text-transparent`}>
            ${drop.price}
          </span>
        </div>

        {/* Stock Status */}
        <div className="flex justify-between items-center text-xs mb-4">
          <span className="text-slate-500 font-medium">Available Seats</span>
          <span className={`font-semibold text-sm ${
            isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {isOutOfStock ? 'Sold Out' : `${drop.available_stock} / ${drop.total_stock}`}
          </span>
        </div>

        {/* Reserve CTA */}
        <button
          id={`reserve-btn-${drop.id}`}
          disabled={isOutOfStock || isReserving}
          onClick={onReserve}
          className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all select-none ${
            isOutOfStock
              ? 'bg-slate-800/60 text-slate-600 border border-slate-700/40 cursor-not-allowed'
              : isReserving
              ? 'bg-purple-700/50 text-slate-300 cursor-wait'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white active:scale-[0.97] shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35'
          }`}
        >
          {isReserving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span>Securing Lock…</span></>
          ) : isOutOfStock ? (
            <><XCircle className="w-4 h-4" /><span>Out of Stock</span></>
          ) : (
            <><Sparkles className="w-4 h-4" /><span>Reserve Now</span></>
          )}
        </button>
      </div>
    </article>
  );
};

export default ProductCard;
