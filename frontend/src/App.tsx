import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ShoppingBag, 
  User as UserIcon, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Database,
  Play
} from 'lucide-react';

interface Drop {
  id: number;
  name: string;
  price: number;
  total_stock: number;
  available_stock: number;
  createdAt: string;
}

interface Reservation {
  id: number;
  user_id: number;
  drop_id: number;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  expires_at: string;
  createdAt?: string;
}

interface AppUser {
  id: number;
  username: string;
}

const BACKEND_URL = 'http://localhost:5000';

// Circular Countdown Timer Component
const CountdownTimer: React.FC<{ 
  expiresAt: string; 
  onExpire: () => void; 
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' 
}> = ({ expiresAt, onExpire, status }) => {
  const calculateSecondsLeft = () => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  };

  const [timeLeft, setTimeLeft] = useState(calculateSecondsLeft());

  useEffect(() => {
    if (status !== 'PENDING' || timeLeft <= 0) return;

    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, status, timeLeft]);

  if (status !== 'PENDING') {
    return null;
  }

  // Radius of the circle is 16, circumference = 2 * PI * r = 100.5
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / 60) * circumference;

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle 
            cx="16" 
            cy="16" 
            r={radius} 
            className="stroke-slate-800 fill-transparent" 
            strokeWidth="3"
          />
          <circle 
            cx="16" 
            cy="16" 
            r={radius} 
            className="stroke-amber-400 fill-transparent transition-all duration-1000" 
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
          />
        </svg>
        <span className="absolute text-[10px] font-bold text-amber-400">{timeLeft}s</span>
      </div>
      <span>Expires soon</span>
    </div>
  );
};

function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('techzu_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [usernameInput, setUsernameInput] = useState('');
  const [drops, setDrops] = useState<Drop[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservingDropId, setReservingDropId] = useState<number | null>(null);
  const [purchasingResId, setPurchasingResId] = useState<number | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [stockPulseId, setStockPulseId] = useState<number | null>(null);
  const [isLoadingDrops, setIsLoadingDrops] = useState(true);

  // Pre-configured simulation users
  const SIMULATION_USERS = ['Alpha_Buyer', 'Beta_Buyer', 'Gamma_Buyer', 'Delta_Buyer'];

  // Initialize Socket.io connection and fetch initial data
  useEffect(() => {
    const socket: Socket = io(BACKEND_URL);

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to real-time events server');
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from server');
      setSocketConnected(false);
    });

    // Listen for real-time stock updates
    socket.on('stock_update', (data: { dropId: number; availableStock: number }) => {
      console.log('[SOCKET] Stock update received:', data);
      
      setDrops(prevDrops => 
        prevDrops.map(drop => {
          if (drop.id === data.dropId) {
            // Trigger temporary visual pulse
            setStockPulseId(data.dropId);
            setTimeout(() => setStockPulseId(null), 1000);
            return { ...drop, available_stock: data.availableStock };
          }
          return drop;
        })
      );
    });

    // Fetch initial list of drops
    fetchDrops();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch reservations whenever the user changes
  useEffect(() => {
    if (user) {
      fetchReservations(user.id);
    } else {
      setReservations([]);
    }
  }, [user]);

  const fetchDrops = async () => {
    setIsLoadingDrops(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/drops`);
      if (response.ok) {
        const data = await response.json();
        setDrops(data);
      } else {
        toast.error('Failed to load drops from backend database.');
      }
    } catch (err) {
      console.error('[FETCH_DROPS_ERROR]', err);
      toast.error('Could not connect to database server.');
    } finally {
      setIsLoadingDrops(false);
    }
  };

  const fetchReservations = async (userId: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reservations?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setReservations(data);
      }
    } catch (err) {
      console.error('[FETCH_RESERVATIONS_ERROR]', err);
    }
  };

  const handleUserLogin = async (username: string) => {
    if (!username.trim()) return;
    const cleanUsername = username.trim();

    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });

      if (response.ok) {
        const userData: AppUser = await response.json();
        setUser(userData);
        localStorage.setItem('techzu_user', JSON.stringify(userData));
        setUsernameInput('');
        toast.success(`Logged in as ${userData.username}`);
      } else {
        toast.error('Failed to login or register user.');
      }
    } catch (err) {
      console.error('[LOGIN_ERROR]', err);
      toast.error('Server connection error during login.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('techzu_user');
    toast.success('Logged out successfully.');
  };

  const handleReserve = async (dropId: number) => {
    if (!user) {
      toast.error('Please log in or select a simulation user first.');
      return;
    }

    // Optimistic UI check & loading lock
    setReservingDropId(dropId);

    try {
      const response = await fetch(`${BACKEND_URL}/api/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, dropId }),
      });

      const data = await response.json();

      if (response.status === 201 && data.success) {
        toast.success('Item reserved! Secure it in 60s.', { duration: 4000 });
        
        // Prepend new pending reservation to user's list
        setReservations(prev => [data.reservation, ...prev]);
      } else {
        // Handle error cases (out of stock, server error)
        const errorMsg = data.message || 'Reservation failed.';
        toast.error(`Error: ${errorMsg}`, { duration: 4000 });
      }
    } catch (err) {
      console.error('[RESERVE_ERROR]', err);
      toast.error('Network error during reservation.');
    } finally {
      setReservingDropId(null);
    }
  };

  const handlePurchase = async (reservationId: number) => {
    if (!user) return;

    setPurchasingResId(reservationId);

    try {
      const response = await fetch(`${BACKEND_URL}/api/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, userId: user.id }),
      });

      const data = await response.json();

      if (response.status === 201 && data.success) {
        toast.success('Purchase complete! Product secured.', {
          icon: '🎉',
          duration: 5000,
        });

        // Mark the reservation as completed in state
        setReservations(prev => 
          prev.map(res => {
            if (res.id === reservationId) {
              return { ...res, status: 'COMPLETED' };
            }
            return res;
          })
        );
      } else {
        const errorMsg = data.message || 'Purchase execution failed.';
        toast.error(`Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('[PURCHASE_ERROR]', err);
      toast.error('Network error executing purchase.');
    } finally {
      setPurchasingResId(null);
    }
  };

  // Helper called when the timer ends in the client UI
  const handleReservationExpired = (reservationId: number) => {
    // Locally set reservation status to expired
    setReservations(prev =>
      prev.map(res => {
        if (res.id === reservationId && res.status === 'PENDING') {
          toast.error(`Reservation #${reservationId} expired! Stock released.`);
          return { ...res, status: 'EXPIRED' };
        }
        return res;
      })
    );
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col justify-between">
      <Toaster />
      
      {/* Top Header Section */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-purple-500 animate-pulse" />
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-pink-500 to-indigo-400 bg-clip-text text-transparent">
              Techzu Inventory Drop System
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400 font-light">
            Real-time pessimistic locking system guarding stock against overselling.
          </p>
        </div>

        {/* Real-time Connection status */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold glass-panel ${
            socketConnected 
              ? 'text-emerald-400 border-emerald-500/20' 
              : 'text-rose-400 border-rose-500/20'
          }`}>
            {socketConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-pulse" />
                <span>Live Stock Sync Active</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline / Retrying Sync</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid: fixed 2-column structure: 1fr left, 380px right */}
      <main className="grid grid-cols-[1fr_380px] gap-8 items-start mb-12">
        
        {/* Left Column - Live Drops Catalog */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
              <Database className="w-5 h-5 text-purple-400" />
              Active Drops Catalog
            </h2>
            <button 
              onClick={fetchDrops}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              Refresh Items
            </button>
          </div>

          {isLoadingDrops ? (
            <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span>Querying drops database...</span>
            </div>
          ) : drops.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
              No drops available. Insert rows into your database to display them here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {drops.map((drop) => {
                const isReserving = reservingDropId === drop.id;
                const isOutOfStock = drop.available_stock <= 0;
                const hasRecentPulse = stockPulseId === drop.id;

                // Percentage stock indicator
                const stockPercent = Math.min(
                  100,
                  Math.max(0, (drop.available_stock / drop.total_stock) * 100)
                );

                return (
                  <div 
                    key={drop.id} 
                    className={`glass-panel rounded-2xl p-6 glass-panel-hover transition-all duration-300 ${
                      hasRecentPulse ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-purple-500/10' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          ID #{drop.id}
                        </span>
                        <h3 className="text-lg font-bold mt-2 text-slate-100">{drop.name}</h3>
                      </div>
                      <span className="text-xl font-black text-purple-400">${drop.price}</span>
                    </div>

                    {/* Stock level information */}
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Stock Availability:</span>
                        <span className={`font-bold transition-all ${
                          isOutOfStock 
                            ? 'text-rose-400' 
                            : drop.available_stock <= 2 
                            ? 'text-amber-400 animate-pulse' 
                            : 'text-emerald-400'
                        }`}>
                          {isOutOfStock ? 'Sold Out' : `${drop.available_stock} / ${drop.total_stock} Left`}
                        </span>
                      </div>
                      
                      {/* Bar indicator */}
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOutOfStock 
                              ? 'bg-rose-600' 
                              : drop.available_stock <= 2 
                              ? 'bg-amber-500' 
                              : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                          }`}
                          style={{ width: `${stockPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action button with Optimistic Loading state */}
                    <button
                      disabled={isOutOfStock || isReserving}
                      onClick={() => handleReserve(drop.id)}
                      className={`w-full py-2.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all select-none ${
                        isOutOfStock
                          ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                          : isReserving
                          ? 'bg-purple-600/50 text-slate-200 cursor-wait'
                          : 'bg-purple-600 hover:bg-purple-500 active:scale-95 text-white hover:shadow-lg hover:shadow-purple-500/20'
                      }`}
                    >
                      {isReserving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Acquiring DB Lock...</span>
                        </>
                      ) : isOutOfStock ? (
                        <span>Out of Stock</span>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-purple-200" />
                          <span>Reserve Instantly</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column - User Session and Reservations (fixed width 380px) */}
        <aside className="space-y-6 shrink-0 w-[380px]">
          
          {/* User Session Controller */}
          <section className="glass-panel rounded-2xl p-6 border border-slate-800/80">
            <h2 className="text-md font-bold mb-4 flex items-center gap-2 text-slate-200">
              <UserIcon className="w-4 h-4 text-purple-400" />
              User Simulation Session
            </h2>

            {!user ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 font-light">
                  Input a custom username or choose one of the simulated bots below to start testing DB locks.
                </p>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUserLogin(usernameInput);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    required
                    placeholder="Enter custom username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                  />
                  <button 
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-purple-600 text-xs font-semibold hover:bg-purple-500 text-white transition-colors"
                  >
                    Join
                  </button>
                </form>

                <div className="border-t border-slate-800/50 pt-3">
                  <span className="text-[10px] text-slate-500 block mb-2 font-bold tracking-wider uppercase">
                    Quick Select Simulated Bots
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {SIMULATION_USERS.map((username) => (
                      <button
                        key={username}
                        onClick={() => handleUserLogin(username)}
                        className="py-1 px-2 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-400 hover:text-purple-300 hover:border-purple-500/30 transition-all text-left truncate flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700 inline-block" />
                        {username}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/80">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/10">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-sm font-bold text-slate-200 block truncate">{user.username}</span>
                      <span className="text-[10px] text-slate-500">PostgreSQL ID #{user.id}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-rose-400 hover:underline shrink-0"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Active Reservations Panel */}
          <section className="glass-panel rounded-2xl p-6 border border-slate-800/80">
            <h2 className="text-md font-bold mb-4 flex items-center gap-2 text-slate-200">
              <Clock className="w-4 h-4 text-purple-400" />
              Active User Reservations
            </h2>

            {!user ? (
              <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                Please log in to view active reservation cart.
              </div>
            ) : reservations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No reservation locks found for this user.
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {reservations.map((res) => {
                  const isPending = res.status === 'PENDING';
                  const isCompleted = res.status === 'COMPLETED';
                  const isExpired = res.status === 'EXPIRED';
                  const isPurchasing = purchasingResId === res.id;

                  return (
                    <div 
                      key={res.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        isCompleted 
                          ? 'bg-emerald-950/20 border-emerald-950/60 text-slate-300' 
                          : isExpired 
                          ? 'bg-slate-900/40 border-slate-800/80 text-slate-500' 
                          : 'bg-amber-950/10 border-amber-900/30 text-slate-200 pulsing-border'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold">
                          RESERVATION #{res.id}
                        </span>
                        
                        {/* Status tag */}
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isCompleted 
                            ? 'bg-emerald-400/10 text-emerald-400' 
                            : isExpired 
                            ? 'bg-slate-800 text-slate-500' 
                            : 'bg-amber-400/10 text-amber-400 animate-pulse'
                        }`}>
                          {res.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mb-4 space-y-1">
                        <div>Drop: <span className="text-slate-300 font-semibold">Drop ID #{res.drop_id}</span></div>
                        <div>Date Locked: {new Date(res.expires_at).toLocaleTimeString()}</div>
                      </div>

                      {/* Visual Countdown Timer */}
                      {isPending && (
                        <div className="mt-2 flex flex-col gap-3">
                          <CountdownTimer 
                            expiresAt={res.expires_at} 
                            onExpire={() => handleReservationExpired(res.id)}
                            status={res.status}
                          />

                          {/* Purchase simulation button */}
                          <button
                            disabled={isPurchasing}
                            onClick={() => handlePurchase(res.id)}
                            className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
                          >
                            {isPurchasing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 text-emerald-200" />
                            )}
                            <span>Simulate Purchase</span>
                          </button>
                        </div>
                      )}

                      {/* Completed Indicators */}
                      {isCompleted && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mt-1">
                          <CheckCircle className="w-4 h-4" />
                          <span>Purchased & Secured</span>
                        </div>
                      )}

                      {/* Expired Indicators */}
                      {isExpired && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-1">
                          <XCircle className="w-4 h-4" />
                          <span>Released (Locked expired)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </aside>
      </main>

      {/* Footer System Diagnostics */}
      <footer className="mt-auto border-t border-slate-800/80 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500">
        <span>Techzu High-Traffic Real-Time Inventory Control</span>
        <div className="flex items-center gap-2 mt-2 md:mt-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
          <span>System Status: Fully Operational</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
