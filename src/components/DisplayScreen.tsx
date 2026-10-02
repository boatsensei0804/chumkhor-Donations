import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX, Settings, ExternalLink } from 'lucide-react';
import { CountUp } from './CountUp';
import { DonationPopup } from './DonationPopup';
import { DonorTicker } from './DonorTicker';
import { CountdownTimer } from './CountdownTimer';
import { AnimatedBackground } from './AnimatedBackground';
import { AppSettings, BroadcastAction, DonationItem, PopupPayload } from '../types';
import { getStoredSettings, getStoredTotal, getStoredHistory, saveStoredHistory, saveStoredSettings, saveStoredTotal } from '../utils/storage';
import { apiFetchState, getGoogleScriptUrl } from '../utils/api';
import { syncChannel } from '../utils/channel';
import { soundPlayer } from '../utils/sound';
import { fireCeremonialConfetti } from '../utils/confetti';

interface DisplayScreenProps {
  onOpenAdmin?: () => void;
}

export const DisplayScreen: React.FC<DisplayScreenProps> = ({ onOpenAdmin }) => {
  const [total, setTotal] = useState<number>(getStoredTotal);
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings);
  const [donations, setDonations] = useState<DonationItem[]>(getStoredHistory);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Popup Queue
  const [popupQueue, setPopupQueue] = useState<PopupPayload[]>([]);
  const [currentPopup, setCurrentPopup] = useState<PopupPayload | null>(null);

  // Track known donation IDs to prevent duplicate celebration popups
  const seenDonationIdsRef = useRef<Set<string>>(new Set(donations.map((d) => d.id)));
  const isFirstFetchRef = useRef<boolean>(true);

  // Periodic polling from Google Sheets / API
  useEffect(() => {
    let isCancelled = false;

    const fetchLatest = async () => {
      try {
        const state = await apiFetchState();
        if (isCancelled || !state) return;

        // First successful fetch: record all IDs without firing popups for historical entries
        if (isFirstFetchRef.current) {
          isFirstFetchRef.current = false;
          setTotal(state.total);
          setDonations(state.donations);
          setSettings(state.settings);
          (state.donations || []).forEach((d) => seenDonationIdsRef.current.add(d.id));
          return;
        }

        // Subsequent polls: detect newly added donations
        const incoming = state.donations || [];
        const newDonations: DonationItem[] = [];

        incoming.forEach((item) => {
          if (!seenDonationIdsRef.current.has(item.id)) {
            seenDonationIdsRef.current.add(item.id);
            newDonations.push(item);
          }
        });

        // Trigger celebration popups for newly added donations
        if (newDonations.length > 0) {
          const newPopups: PopupPayload[] = [];
          newDonations.forEach((item) => {
            if (item.showPopup !== false) {
              newPopups.push({
                id: item.id,
                donorName: item.donorName,
                amount: item.amount,
                timestamp: item.timestamp,
                duration: (state.settings || settings).popupDurationSeconds || 5,
              });
            }
          });
          if (newPopups.length > 0) {
            setPopupQueue((prev) => [...prev, ...newPopups]);
          }
        }

        setTotal(state.total);
        setDonations(incoming);
        if (state.settings) {
          setSettings(state.settings);
        }

        // Save locally for offline backup
        saveStoredTotal(state.total);
        saveStoredHistory(incoming);
        if (state.settings) {
          saveStoredSettings(state.settings);
        }
      } catch (err) {
        // Quietly maintain state during temporary network glitches
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, 3500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [settings.popupDurationSeconds]);

  // Auto-hide controls after inactivity
  const handleMouseMove = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3500);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [handleMouseMove]);

  // Process Popup Queue
  useEffect(() => {
    if (!currentPopup && popupQueue.length > 0) {
      const nextPopup = popupQueue[0];
      setCurrentPopup(nextPopup);
      setPopupQueue((prev) => prev.slice(1));

      // Play chime sound if enabled
      if (settings.soundEnabled && !soundMuted) {
        soundPlayer.playCeremonyBell();
      }
      // Fire confetti
      fireCeremonialConfetti();
    }
  }, [currentPopup, popupQueue, settings.soundEnabled, soundMuted]);

  const handlePopupFinished = useCallback(() => {
    setCurrentPopup(null);
  }, []);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = syncChannel.subscribe((action: BroadcastAction) => {
      if (action.type === 'UPDATE_TOTAL') {
        setTotal(action.payload);
      } else if (action.type === 'ADD_DONATION') {
        const item = action.payload;
        seenDonationIdsRef.current.add(item.id);
        setTotal((prev) => prev + item.amount);
        setDonations((prev) => [item, ...prev]);
        if (item.showPopup) {
          setPopupQueue((prev) => [
            ...prev,
            {
              id: item.id,
              donorName: item.donorName,
              amount: item.amount,
              timestamp: item.timestamp,
              duration: settings.popupDurationSeconds,
            },
          ]);
        }
      } else if (action.type === 'TRIGGER_POPUP') {
        setPopupQueue((prev) => [...prev, action.payload]);
      } else if (action.type === 'UPDATE_SETTINGS') {
        setSettings(action.payload);
      } else if (action.type === 'DELETE_DONATION') {
        seenDonationIdsRef.current.delete(action.payload.id);
        setTotal((prev) => Math.max(0, prev - action.payload.deductedAmount));
        setDonations((prev) => prev.filter((d) => d.id !== action.payload.id));
      } else if (action.type === 'RESET_DATA') {
        seenDonationIdsRef.current.clear();
        setTotal(action.payload.initialTotal);
        setSettings((prev) => ({ ...prev, title: action.payload.initialTitle }));
        setDonations([]);
        setCurrentPopup(null);
        setPopupQueue([]);
      } else if (action.type === 'SYNC') {
        setTotal(action.payload.total);
        setDonations(action.payload.donations);
        setSettings(action.payload.settings);
        action.payload.donations.forEach((d) => seenDonationIdsRef.current.add(d.id));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [settings.popupDurationSeconds]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const backgroundSrc = settings.customBackgroundUrl || '/background.png';

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none flex flex-col items-center justify-between text-slate-800 font-thai">
      {/* Official CKP 32nd Anniversary Living Animated Banner */}
      <AnimatedBackground
        imageSrc={backgroundSrc}
        enableParticles={true}
        isCelebrating={currentPopup !== null}
      />

      {/* Top Floating Controls (Auto-hide on idle) */}
      <div
        className={`absolute top-4 right-4 z-40 flex items-center gap-2 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {getGoogleScriptUrl() && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/90 text-white font-medium text-xs shadow-md backdrop-blur border border-emerald-400/50">
            <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
            <span>เชื่อมต่อ Google Sheet</span>
          </div>
        )}

        <button
          onClick={() => setSoundMuted(!soundMuted)}
          className="p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md backdrop-blur border border-white/60 transition-all hover:scale-105"
          title={soundMuted ? 'เปิดเสียงกระดิ่ง' : 'ปิดเสียงกระดิ่ง'}
        >
          {soundMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-blue-600" />}
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md backdrop-blur border border-white/60 transition-all hover:scale-105"
          title={isFullscreen ? 'ออกจากเต็มหน้าจอ' : 'เต็มหน้าจอ (Fullscreen)'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/90 hover:bg-white text-blue-900 font-semibold text-sm shadow-md backdrop-blur transition-all hover:scale-105 border border-white/80"
            title="ไปที่หน้า Admin"
          >
            <Settings className="w-4 h-4 text-blue-600" />
            <span>จัดการยอด (Admin)</span>
          </button>
        )}

        <button
          onClick={() => window.open(window.location.pathname + '?screen=admin', '_blank')}
          className="p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md backdrop-blur border border-white/60 transition-all hover:scale-105"
          title="เปิดหน้า Admin ในหน้าต่างใหม่"
        >
          <ExternalLink className="w-5 h-5 text-blue-600" />
        </button>
      </div>

      {/* Main Top Header Area */}
      <header className="w-full pt-2 sm:pt-3 md:pt-4 px-4 text-center z-10 flex flex-col items-center">
        <div className="inline-block max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-3xl px-6 py-1.5 sm:px-10 sm:py-2.5 rounded-full bg-white/90 backdrop-blur-md border border-white/80 shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-blue-950 tracking-wide font-display drop-shadow-sm">
            {settings.title || 'คณะผ้าป่าเพื่อการศึกษา'}
          </h1>
          {settings.subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm md:text-base font-medium text-blue-900/80">
              {settings.subtitle}
            </p>
          )}
        </div>
      </header>

      {/* Center Main Stage */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 z-10">
        <div className="relative flex flex-col items-center text-center w-full">
          {/* Countdown Timer: 12:00 วันเสาร์ที่ 3 ตุลาคม */}
          {settings.countdownEnabled !== false && (
            <CountdownTimer
              targetDate={settings.countdownTargetDate || '2026-10-03T12:00:00'}
              title={settings.countdownTitle || 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.'}
              enabled={true}
              className="mb-3 sm:mb-4 transform hover:scale-105 transition-transform"
            />
          )}

          {/* Badge: 💰 ยอดบริจาครวม */}
          <div className="inline-flex items-center gap-2.5 px-8 py-2 sm:px-10 sm:py-3 md:px-12 md:py-3.5 rounded-full bg-white/90 text-blue-950 font-black text-xl sm:text-2xl md:text-3xl lg:text-4xl shadow-lg border border-white/90 mb-3 sm:mb-4 md:mb-5 tracking-wide">
            <span className="text-2xl sm:text-3xl md:text-4xl">💰</span>
            <span className="font-display">ยอดบริจาครวม</span>
          </div>

          {/* Grand Total Amount Display Plaque */}
          <div className="relative px-10 py-5 sm:px-16 sm:py-8 md:px-20 md:py-10 lg:px-28 lg:py-12 rounded-3xl sm:rounded-[2.5rem] bg-white/95 backdrop-blur-md shadow-2xl border-2 border-white/80">
            <div className="relative flex items-baseline justify-center font-black tracking-tight leading-none text-blue-950 font-display">
              <CountUp
                end={total}
                duration={1200}
                prefix="฿ "
                className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] xl:text-[12rem] font-black text-blue-950 drop-shadow-sm"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Scrolling Donor Ticker */}
      <DonorTicker donations={donations} />

      {/* Pop-up Notification for Donors */}
      <DonationPopup
        popup={currentPopup}
        onFinished={handlePopupFinished}
        defaultDuration={settings.popupDurationSeconds}
      />
    </div>
  );
};
