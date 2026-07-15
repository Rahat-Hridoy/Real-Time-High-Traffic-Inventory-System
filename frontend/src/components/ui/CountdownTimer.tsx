/**
 * components/ui/CountdownTimer.tsx
 * SVG circular countdown for active (PENDING) reservations.
 */

import React, { useState, useEffect } from 'react';
import { RESERVATION_WINDOW_S } from '../../constants';
import type { Reservation } from '../../types';

interface Props {
  expiresAt: string;
  status: Reservation['status'];
  onExpire: () => void;
}

function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

const CountdownTimer: React.FC<Props> = ({ expiresAt, status, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState(() => secondsLeft(expiresAt));

  useEffect(() => {
    if (status !== 'PENDING' || timeLeft <= 0) return;

    const id = setInterval(() => {
      const remaining = secondsLeft(expiresAt);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt, status, timeLeft, onExpire]);

  if (status !== 'PENDING') return null;

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (timeLeft / RESERVATION_WINDOW_S) * circumference;
  const isUrgent = timeLeft <= 15;

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${isUrgent ? 'text-rose-400' : 'text-amber-400'}`}>
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle cx="16" cy="16" r={radius} className="stroke-slate-800 fill-transparent" strokeWidth="3" />
          <circle
            cx="16" cy="16" r={radius}
            className={`fill-transparent transition-all duration-1000 ${isUrgent ? 'stroke-rose-400' : 'stroke-amber-400'}`}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="absolute text-[10px] font-bold">{timeLeft}s</span>
      </div>
      <span>{isUrgent ? 'Expiring!' : 'Expires soon'}</span>
    </div>
  );
};

export default CountdownTimer;
