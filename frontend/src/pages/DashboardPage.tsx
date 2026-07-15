import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Database, Loader2, Package, ShoppingCart } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import ProductCard from '../components/drops/ProductCard';
import ReservationItem from '../components/reservations/ReservationItem';
import { CARD_ACCENTS } from '../constants';
import type { AppUser, Drop, Reservation } from '../types';

interface Props {
  user: AppUser;
  drops: Drop[];
  reservations: Reservation[];
  socketConnected: boolean;
  reservingDropId: number | null;
  purchasingResId: number | null;
  stockPulseId: number | null;
  isLoadingDrops: boolean;
  onRefreshDrops: () => void;
  onReserve: (dropId: number) => Promise<Reservation | undefined>;
  onPurchase: (reservationId: number) => void;
  onReservationExpired: (reservationId: number) => void;
  onLogout: () => void;
}

const DashboardPage: React.FC<Props> = ({
  user,
  drops,
  reservations,
  socketConnected,
  reservingDropId,
  purchasingResId,
  stockPulseId,
  isLoadingDrops,
  onRefreshDrops,
  onReserve,
  onPurchase,
  onReservationExpired,
  onLogout,
}) => {
  const navigate = useNavigate();
  const pendingCount = reservations.filter(r => r.status === 'PENDING').length;

  const handleReserve = async (dropId: number) => {
    const res = await onReserve(dropId);
    if (res) {
      navigate(`/purchase/${dropId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-slate-800 font-sans">
      <Navbar user={user} socketConnected={socketConnected} onLogout={onLogout} />

      {/* ── Main content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">

        {/* Page heading row */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Active Drops <span className="text-slate-500 font-normal">Catalog</span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">
              Real-time inventory with pessimistic locking
            </p>
          </div>

          <button
            id="refresh-drops-btn"
            onClick={onRefreshDrops}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-slate-700 hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold shadow-xs cursor-pointer select-none"
          >
            <Database className="w-4 h-4 text-slate-500" />
            Refresh Drops
          </button>
        </div>

        {/* ── 2-column grid: catalog | sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

          {/* Left — products */}
          <section aria-label="Drops catalog">
            {isLoadingDrops ? (
              <div className="bg-white border border-gray-150 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-slate-400 shadow-xs">
                <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
                <span className="text-sm">Loading drops…</span>
              </div>
            ) : drops.length === 0 ? (
              <div className="bg-white border border-gray-150 rounded-2xl p-16 text-center text-slate-400 shadow-xs">
                <Package className="w-12 h-12 text-slate-350 mx-auto mb-3" />
                <p>No drops available. Add rows to your database to display them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {drops.map((drop, idx) => (
                  <ProductCard
                    key={drop.id}
                    drop={drop}
                    accentClass={CARD_ACCENTS[idx % CARD_ACCENTS.length]}
                    isReserving={reservingDropId === drop.id}
                    hasPulse={stockPulseId === drop.id}
                    onReserve={() => handleReserve(drop.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right — reservations sidebar */}
          <aside className="space-y-5 shrink-0" aria-label="Reservations">

            {/* Logged-in user widget */}
            <div className="bg-white border border-gray-150 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-extrabold text-sm">
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-sm text-slate-800 truncate">{user.username}</p>
                <p className="text-[11px] text-slate-400 font-semibold">ID #{user.id}</p>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            </div>

            {/* Reservations panel */}
            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-800" />
                <h2 className="font-bold text-sm text-slate-800">My Reservations</h2>
                {pendingCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                    {pendingCount} active
                  </span>
                )}
              </div>

              {reservations.filter(r => r.status === 'COMPLETED').length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-gray-200 rounded-xl">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No completed purchases yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-0.5">
                  {reservations
                    .filter(r => r.status === 'COMPLETED')
                    .map(res => (
                      <ReservationItem
                        key={res.id}
                        res={res}
                        drops={drops}
                        isPurchasing={purchasingResId === res.id}
                        onPurchase={() => onPurchase(res.id)}
                        onExpire={() => onReservationExpired(res.id)}
                      />
                    ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 py-4 px-6 flex items-center justify-between text-xs text-slate-400 font-semibold bg-white mt-12 shadow-xs">
        <span>Techzu &middot; Real-Time High-Traffic Inventory System</span>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
          <span>System {socketConnected ? 'Operational' : 'Degraded'}</span>
        </div>
      </footer>
    </div>
  );
};

export default DashboardPage;
