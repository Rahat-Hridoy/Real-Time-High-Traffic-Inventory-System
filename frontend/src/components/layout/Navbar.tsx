/**
 * components/layout/Navbar.tsx
 * Sticky top navigation bar with brand, live-sync badge, and user dropdown.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Wifi,
  WifiOff,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import type { AppUser } from '../../types';

interface Props {
  user: AppUser;
  socketConnected: boolean;
  onLogout: () => void;
}

const Navbar: React.FC<Props> = ({ user, socketConnected, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const avatar = user.username[0].toUpperCase();

  return (
    <nav className="bg-white border-b border-gray-150 sticky top-0 z-50 px-6 h-16 flex items-center justify-between gap-4 shadow-xs">
      {/* ── Brand ── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
          <ShoppingBag className="w-4 h-4 text-white" />
        </div>
        <span className="font-extrabold text-lg tracking-tight text-slate-900">
          Techzu Drops
        </span>
      </div>

      {/* ── Right side ── */}
      <div className="flex items-center gap-4">
        {/* Live-sync pill */}
        <div
          aria-label={socketConnected ? 'Live sync active' : 'Offline'}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            socketConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xxs'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {socketConnected ? (
            <><Wifi className="w-3 h-3 text-emerald-500 animate-pulse" /><span>Live Sync</span></>
          ) : (
            <><WifiOff className="w-3 h-3 text-rose-500" /><span>Offline</span></>
          )}
        </div>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="nav-user-menu-btn"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold shadow-xxs cursor-pointer select-none"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-extrabold text-xs">
              {avatar}
            </div>
            <span className="text-sm font-bold text-slate-700 max-w-[120px] truncate hidden sm:block">
              {user.username}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-150 rounded-2xl p-2 shadow-lg z-50"
            >
              {/* User info header */}
              <div className="px-3 py-2.5 mb-1">
                <p className="text-sm font-extrabold text-slate-800 truncate">{user.username}</p>
                <p className="text-[11px] text-slate-400 font-semibold">PostgreSQL ID #{user.id}</p>
              </div>

              <div className="h-px bg-gray-100 mx-1 mb-1" />

              {/* Actions */}
              <button
                role="menuitem"
                id="nav-logout-btn"
                onClick={() => { setDropdownOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-all select-none cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
