/**
 * components/drops/ProductCard.tsx
 * E-commerce-style card for a single Drop item.
 */

import React from 'react';
import { Package, Zap } from 'lucide-react';
import type { Drop } from '../../types';

interface Props {
  drop: Drop;
  accentClass: string; // Left in for props compatibility
  isReserving: boolean;
  hasPulse: boolean;
  onReserve: () => void;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-emerald-500',
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

const ProductCard: React.FC<Props> = ({ drop, isReserving, hasPulse, onReserve }) => {
  const isOutOfStock = drop.available_stock <= 0;
  const isLowStock = !isOutOfStock && drop.available_stock <= 3;

  // Format footer text based on recent buyers list length
  const buyersCount = drop.recentBuyers ? drop.recentBuyers.length : 0;
  let buyerText = '';
  if (buyersCount === 1) {
    buyerText = `${drop.recentBuyers![0].username} just grabbed this`;
  } else if (buyersCount === 2) {
    buyerText = `${drop.recentBuyers![0].username} and 1 other just grabbed this`;
  } else if (buyersCount >= 3) {
    buyerText = `${drop.recentBuyers![0].username} and 2 others just grabbed this`;
  }

  return (
    <article
      className={`bg-white border border-gray-150 rounded-2xl p-5 shadow-xs transition-all duration-300 flex flex-col justify-between ${
        hasPulse ? 'ring-2 ring-purple-500/20' : ''
      }`}
    >
      <div>
        {/* ── Image Area ── */}
        <div className="relative aspect-[4/3] bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden">
          <Package className="w-14 h-14 text-gray-300 stroke-[1.25]" />
        </div>

        {/* ── Details ── */}
        <h3 className="text-slate-800 text-[15px] font-bold mt-4 tracking-tight leading-snug">
          {drop.name}
        </h3>

        {/* ── Price and Badge Row ── */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-slate-900 text-lg font-extrabold tracking-tight">
            ${drop.price}
          </span>

          {/* ── Badge ── */}
          {isOutOfStock ? (
            <span className="bg-gray-100 text-gray-500 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-gray-200/50">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
              Sold Out
            </span>
          ) : isLowStock ? (
            <span className="bg-rose-50 text-rose-500 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-rose-200/50">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
              {drop.available_stock} left
            </span>
          ) : (
            <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200/50">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              {drop.available_stock} left
            </span>
          )}
        </div>
      </div>

      <div>
        {/* ── Button ── */}
        {isOutOfStock ? (
          <button
            disabled
            className="w-full bg-gray-100 text-gray-400 rounded-xl py-3 px-4 text-xs font-bold mt-4 flex items-center justify-center gap-2 border border-gray-100 cursor-not-allowed select-none"
          >
            Sold Out
          </button>
        ) : (
          <button
            onClick={onReserve}
            className="w-full bg-black text-white hover:bg-neutral-800 transition-colors rounded-xl py-3 px-4 text-xs font-bold mt-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform select-none cursor-pointer"
          >
            <span>Reserve</span>
          </button>
        )}

        {/* ── Footer / Recently Purchased ── */}
        <div className="mt-4 flex flex-col justify-start">
          {buyersCount > 0 ? (
            <>
              {/* Headline */}
              <div className="flex items-center gap-1 text-slate-400 font-bold text-[9px] tracking-wider uppercase mb-2">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>Recently Purchased</span>
              </div>
              
              {/* Buyer list */}
              <div className="flex items-center">
                <div className="flex -space-x-1.5 overflow-hidden mr-2">
                  {drop.recentBuyers!.slice(0, 3).map((buyer, idx) => (
                    <div
                      key={idx}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white border-2 border-white ring-1 ring-gray-100 ${getAvatarColor(
                        buyer.username
                      )}`}
                    >
                      {buyer.username[0].toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 font-medium truncate">
                  {buyerText}
                </span>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              No purchases yet — be the first
            </p>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
