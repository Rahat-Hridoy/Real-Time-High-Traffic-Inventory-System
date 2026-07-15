import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Package, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import CountdownTimer from '../components/ui/CountdownTimer';
import toast from 'react-hot-toast';
import type { AppUser, Drop, Reservation } from '../types';

interface Props {
  user: AppUser;
  drops: Drop[];
  reservations: Reservation[];
  purchasingResId: number | null;
  onPurchase: (reservationId: number) => Promise<void>;
  onReservationExpired: (reservationId: number) => void;
  socketConnected: boolean;
  onLogout: () => void;
}

const PurchasePage: React.FC<Props> = ({
  user,
  drops,
  reservations,
  purchasingResId,
  onPurchase,
  onReservationExpired,
  socketConnected,
  onLogout,
}) => {
  const { productId } = useParams<{ productId: string }>();
  const [inputUsername, setInputUsername] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const product = drops.find(d => d.id === Number(productId));
  const activeReservation = reservations.find(
    r => r.drop_id === Number(productId) && r.status === 'PENDING'
  );

  const handleConfirmPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReservation) {
      toast.error('No active reservation found.');
      return;
    }

    const trimmed = inputUsername.trim();
    if (!trimmed) {
      toast.error('Please enter your username to confirm.');
      return;
    }

    if (trimmed !== user.username) {
      toast.error(`Username must match your session username: "${user.username}"`);
      return;
    }

    try {
      await onPurchase(activeReservation.id);
      setIsSuccess(true);
    } catch {
      // Error is handled/shown in useInventory toast
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-slate-800 font-sans">
        <Navbar user={user} socketConnected={socketConnected} onLogout={onLogout} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Package className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">The product you are trying to purchase does not exist.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-sm font-bold shadow-xs">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-slate-800 font-sans">
      <Navbar user={user} socketConnected={socketConnected} onLogout={onLogout} />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 flex flex-col justify-center">
        
        {/* Back Link */}
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-bold transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel & Back</span>
          </Link>
        </div>

        {isSuccess ? (
          /* Success Panel */
          <div className="bg-white border border-gray-150 rounded-2xl p-10 text-center shadow-xs max-w-lg mx-auto w-full">
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-16 h-16 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Success! 🎉</h2>
            <p className="text-slate-500 text-sm mt-2 mb-8 leading-relaxed">
              Your purchase for <strong className="text-slate-800">{product.name}</strong> was processed successfully. The stock has been secured.
            </p>
            <Link to="/" className="w-full inline-flex items-center justify-center bg-black hover:bg-neutral-800 text-white rounded-xl py-3.5 px-4 text-sm font-bold transition-colors shadow-xs">
              Back to Home
            </Link>
          </div>
        ) : (
          /* Checkout Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            
            {/* Left: Product Info */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="aspect-[4/3] bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 mb-6 overflow-hidden">
                  <Package className="w-20 h-20 text-gray-300 stroke-[1.25]" />
                </div>
                <h3 className="text-slate-900 text-lg font-bold tracking-tight leading-snug">
                  {product.name}
                </h3>
              </div>
              <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-between">
                <span className="text-slate-550 text-sm font-semibold">Total Price</span>
                <span className="text-slate-900 text-2xl font-extrabold tracking-tight">
                  ${product.price}
                </span>
              </div>
            </div>

            {/* Right: Confirm Form */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              {activeReservation ? (
                <form onSubmit={handleConfirmPurchase} className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-slate-900 text-lg font-bold tracking-tight mb-4">
                      Secure Your Drop
                    </h3>

                    {/* Expiry Countdown */}
                    <div className="mb-6 p-4 bg-amber-50/50 border border-amber-200 rounded-xl flex items-center justify-between shadow-xxs">
                      <span className="text-xs font-bold text-amber-800">Time remaining:</span>
                      <CountdownTimer
                        expiresAt={activeReservation.expires_at}
                        status={activeReservation.status}
                        onExpire={() => onReservationExpired(activeReservation.id)}
                      />
                    </div>

                    {/* Username Confirm Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="confirm-username" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Confirm Username
                      </label>
                      <input
                        id="confirm-username"
                        type="text"
                        required
                        value={inputUsername}
                        onChange={e => setInputUsername(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-250 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 text-sm"
                        placeholder="Type username manually"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={purchasingResId !== null}
                    className="w-full bg-black hover:bg-neutral-800 text-white rounded-xl py-3.5 px-4 text-xs font-bold mt-8 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] transition-transform select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasingResId !== null ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Securing Stock...</span>
                      </>
                    ) : (
                      <span>Confirm Purchase</span>
                    )}
                  </button>
                </form>
              ) : (
                /* Reservation Expired or Not Found */
                <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                  <Package className="w-12 h-12 text-slate-200 mb-4" />
                  <h4 className="text-slate-800 font-bold text-base">No Active Reservation</h4>
                  <p className="text-xs text-slate-405 mt-2 max-w-[200px] leading-relaxed">
                    You do not have a pending reservation for this item, or it has expired.
                  </p>
                  <Link to="/" className="w-full bg-black hover:bg-neutral-800 text-white rounded-xl py-3 px-4 text-xs font-bold mt-8 text-center shadow-xs">
                    Return to Drops
                  </Link>
                </div>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default PurchasePage;
