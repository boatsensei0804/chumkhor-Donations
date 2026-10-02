import React, { useMemo } from 'react';
import { Heart } from 'lucide-react';
import { DonationItem } from '../types';

interface DonorTickerProps {
  donations: DonationItem[];
  isPortrait?: boolean;
  className?: string;
}

export const DonorTicker: React.FC<DonorTickerProps> = ({
  donations,
  isPortrait = false,
  className = '',
}) => {
  // Show nothing if no donations
  if (donations.length === 0) return null;

  // Build ticker items — show up to 30 most recent
  const tickerItems = useMemo(() => {
    return donations.slice(0, 30);
  }, [donations]);

  // Calculate animation duration based on number of items
  // More items = longer duration for comfortable reading speed
  const animationDuration = useMemo(() => {
    const baseRate = isPortrait ? 4 : 5;
    return Math.max(16, tickerItems.length * baseRate);
  }, [tickerItems.length, isPortrait]);

  const renderItem = (item: DonationItem, index: number) => (
    <span
      key={`${item.id}-${index}`}
      className={`inline-flex items-center gap-2.5 whitespace-nowrap ${isPortrait ? 'mx-5' : 'mx-10'}`}
    >
      <Heart className={`${isPortrait ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-rose-400 fill-rose-400 flex-shrink-0`} />
      <span className="font-semibold text-white/95">
        {item.donorName}
      </span>
      <span className="text-amber-300 font-bold">
        ฿{item.amount.toLocaleString('th-TH')}
      </span>
      <span className="text-white/30 mx-3">|</span>
    </span>
  );

  return (
    <div
      className={`w-full overflow-hidden z-20 ${className}`}
      style={{ backdropFilter: 'blur(12px)' }}
    >
      <div className={`bg-blue-950/70 border-t border-white/10 ${isPortrait ? 'py-3 sm:py-3.5' : 'py-5 sm:py-7'}`}>
        {/* Fade edges */}
        <div className="relative">
          <div className={`absolute left-0 top-0 bottom-0 ${isPortrait ? 'w-8 sm:w-12' : 'w-16 sm:w-24'} bg-gradient-to-r from-blue-950/90 to-transparent z-10 pointer-events-none`} />
          <div className={`absolute right-0 top-0 bottom-0 ${isPortrait ? 'w-8 sm:w-12' : 'w-16 sm:w-24'} bg-gradient-to-l from-blue-950/90 to-transparent z-10 pointer-events-none`} />

          {/* Scrolling content */}
          <div
            className={`ticker-scroll flex items-center ${isPortrait ? 'text-sm sm:text-base' : 'text-lg sm:text-xl md:text-2xl'}`}
            style={{
              animationDuration: `${animationDuration}s`,
            }}
          >
            {/* Render twice for seamless loop */}
            <div className="flex items-center flex-shrink-0">
              {tickerItems.map((item, i) => renderItem(item, i))}
            </div>
            <div className="flex items-center flex-shrink-0" aria-hidden="true">
              {tickerItems.map((item, i) => renderItem(item, i + tickerItems.length))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
