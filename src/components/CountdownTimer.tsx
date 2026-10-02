import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate?: string;
  title?: string;
  enabled?: boolean;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDate = '2026-10-03T12:00:00',
  title = 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.',
  enabled = true,
  className = '',
}) => {
  const calculateRemaining = (): TimeRemaining => {
    try {
      const targetTime = new Date(targetDate).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (isNaN(diff) || diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      return { days, hours, minutes, seconds, isExpired: false };
    } catch {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
  };

  const [remaining, setRemaining] = useState<TimeRemaining>(calculateRemaining);

  useEffect(() => {
    if (!enabled) return;

    // Update immediately on targetDate change
    setRemaining(calculateRemaining());

    const intervalId = window.setInterval(() => {
      setRemaining(calculateRemaining());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [targetDate, enabled]);

  if (!enabled) return null;

  if (remaining.isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-700/90 text-white font-bold text-sm sm:text-base shadow-lg border border-emerald-300/40 backdrop-blur-md ${className}`}>
        <span className="text-lg">✨</span>
        <span>ถึงเวลาปิดรับยอดบริจาคตามกำหนดแล้ว</span>
      </div>
    );
  }

  const renderTimeUnit = (value: number, label: string) => (
    <div className="flex flex-col items-center justify-center px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/80 min-w-[50px] sm:min-w-[62px]">
      <span className="text-lg sm:text-2xl md:text-3xl font-black text-blue-950 font-display leading-tight tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] sm:text-xs font-semibold text-slate-500 -mt-0.5">
        {label}
      </span>
    </div>
  );

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 sm:gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-lg ${className}`}>
      {/* Label / Title */}
      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-950 tracking-wide">
        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 animate-pulse" />
        <span>{title}</span>
      </div>

      {/* Countdown Digits */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {renderTimeUnit(remaining.days, 'วัน')}
        <span className="text-blue-950/60 font-black text-base sm:text-xl -mt-3">:</span>
        {renderTimeUnit(remaining.hours, 'ชั่วโมง')}
        <span className="text-blue-950/60 font-black text-base sm:text-xl -mt-3">:</span>
        {renderTimeUnit(remaining.minutes, 'นาที')}
        <span className="text-blue-950/60 font-black text-base sm:text-xl -mt-3">:</span>
        {renderTimeUnit(remaining.seconds, 'วินาที')}
      </div>
    </div>
  );
};
