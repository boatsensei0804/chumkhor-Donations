import React, { useEffect, useState } from 'react';
import { Sparkles, Heart } from 'lucide-react';
import { PopupPayload } from '../types';

interface DonationPopupProps {
  popup: PopupPayload | null;
  onFinished: () => void;
  defaultDuration?: number;
}

export const DonationPopup: React.FC<DonationPopupProps> = ({
  popup,
  onFinished,
  defaultDuration = 5,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!popup) {
      setIsExiting(false);
      return;
    }

    setIsExiting(false);
    const durationMs = (popup.duration || defaultDuration) * 1000;
    
    // Trigger exit animation slightly before dismissing
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, Math.max(durationMs - 450, 500));

    const finishTimer = setTimeout(() => {
      onFinished();
      setIsExiting(false);
    }, durationMs);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [popup, defaultDuration, onFinished]);

  if (!popup) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 pointer-events-none font-thai">
      {/* Soft celestial backdrop overlay with blur */}
      <div 
        className={`absolute inset-0 bg-blue-950/50 backdrop-blur-sm transition-opacity duration-500 ${
          isExiting ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Main Announcement Card: Clean Blue-White Minimalist */}
      <div
        className={`relative w-[92%] max-w-[460px] mx-auto transform transition-all duration-500 ease-out ${
          isExiting 
            ? 'opacity-0 scale-95 -translate-y-6' 
            : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        <div className="relative overflow-hidden rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200/90 text-center">
          {/* Header Ribbon */}
          <div className="inline-flex items-center justify-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-blue-700 via-sky-600 to-blue-700 text-white font-black text-base shadow-md tracking-wide mb-4">
            <Sparkles className="w-4 h-4 text-sky-200 animate-spin" style={{ animationDuration: '8s' }} />
            <span>✨ ขอขอบพระคุณ ✨</span>
            <Sparkles className="w-4 h-4 text-sky-200 animate-spin" style={{ animationDuration: '8s' }} />
          </div>

          {/* Donor Name */}
          <div className="mb-4 px-2">
            <h2 className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight leading-snug drop-shadow-sm break-words font-display">
              {popup.donorName || 'ผู้มีจิตศรัทธา'}
            </h2>
          </div>

          {/* Donation Amount Data Frame: Pure White Background */}
          <div className="inline-block relative w-full max-w-[340px]">
            <div className="px-6 py-4 rounded-2xl bg-white border-2 border-slate-200 shadow-md">
              <p className="text-sm font-bold text-sky-800 mb-0.5 flex items-center justify-center gap-1.5">
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500 animate-bounce" />
                <span>ร่วมบริจาค</span>
              </p>
              <p className="text-3xl sm:text-4xl font-black text-blue-950 tracking-wide font-display tabular-nums">
                ฿ {popup.amount.toLocaleString('th-TH')}
              </p>
            </div>
          </div>

          {/* Footer Blessing */}
          <p className="mt-4 text-xs text-slate-600 font-medium tracking-wide leading-relaxed">
            ขออานิสงส์แห่งบุญกุศล ดลบันดาลให้ท่านและครอบครัวประสบแต่ความสุขความเจริญ
          </p>
        </div>
      </div>
    </div>
  );
};
