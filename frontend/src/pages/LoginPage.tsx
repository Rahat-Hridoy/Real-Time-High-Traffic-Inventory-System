/**
 * pages/LoginPage.tsx
 * Full-page login view: centred card + test-accounts reference panel.
 */

import React, { useState } from 'react';
import { User as UserIcon, Loader2, Zap, Star, CheckCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { SAMPLE_CREDENTIALS } from '../constants';

interface Props {
  onLogin: (username: string) => Promise<void>;
}

const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState<string>(SAMPLE_CREDENTIALS[0].username);
  const [isLoading, setIsLoading] = useState(false);
  const [showText, setShowText] = useState(true);   // eye toggle
  const [selectedIdx, setSelectedIdx] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    setIsLoading(true);
    await onLogin(trimmed);
    setIsLoading(false);
  };

  const selectCredential = (u: string, idx: number) => {
    setUsername(u);
    setSelectedIdx(idx);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* ── Animated blobs ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {/* ── Brand ── */}
        <header className="text-center mb-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Techzu</h1>
          <p className="text-slate-400 text-sm mt-1">High-traffic inventory reservation platform</p>
        </header>

        {/* ── Login card ── */}
        <section className="login-card rounded-3xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-6">Sign in to reserve exclusive drops</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div className="space-y-1.5">
              <label htmlFor="login-username" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="login-username"
                  type={showText ? 'text' : 'password'}
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setSelectedIdx(null); }}
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
                  placeholder="Enter your username"
                />
                <button
                  type="button"
                  aria-label={showText ? 'Hide username' : 'Show username'}
                  onClick={() => setShowText(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Signing in…</span></>
              ) : (
                <><Zap className="w-4 h-4" /><span>Sign In</span></>
              )}
            </button>
          </form>
        </section>

        {/* ── Test accounts card ── */}
        <section className="login-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Test Accounts</span>
            <span className="text-[10px] text-slate-500 ml-auto">Click to auto-fill ↑</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_CREDENTIALS.map((cred, idx) => {
              const isActive = selectedIdx === idx;
              return (
                <button
                  key={cred.username}
                  id={`test-account-${idx}`}
                  type="button"
                  onClick={() => selectCredential(cred.username, idx)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${isActive
                    ? 'bg-purple-600/15 border-purple-500/40 text-purple-300'
                    : 'bg-slate-900/60 border-slate-700/40 text-slate-400 hover:border-purple-500/30 hover:text-slate-300'
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${isActive ? 'bg-purple-400' : 'bg-slate-700 group-hover:bg-purple-500/60'
                      }`} />
                    <span className="text-xs font-medium truncate">{cred.label}</span>
                  </div>
                  {isActive
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    : <Copy className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-600 mt-3 text-center">
            Clicking a card auto-fills the username field above.
          </p>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
