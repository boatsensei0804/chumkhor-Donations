import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX, Settings, ExternalLink, Monitor } from 'lucide-react';
import { CountUp } from './CountUp';
import { DonationPopup } from './DonationPopup';
import { DonorTicker } from './DonorTicker';
import { CountdownTimer } from './CountdownTimer';
import { AnimatedBackground } from './AnimatedBackground';
import { AppSettings, BroadcastAction, DonationItem, PopupPayload } from '../types';
import { getStoredSettings, getStoredTotal, getStoredHistory, saveStoredHistory, saveStoredSettings, saveStoredTotal } from '../utils/storage';
import { apiFetchState, getGoogleScriptUrl } from '../utils/api';
import { syncChannel, RealtimeStatus } from '../utils/channel';
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
  const seenPopupIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef<boolean>(true);

  // Real-time connection status
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(() => syncChannel.getStatus());

  useEffect(() => {
    return syncChannel.onStatusChange((status) => {
      setRealtimeStatus(status);
    });
  }, []);

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

        // Backup pending popup from Google Sheets if any
        const anyState = state as any;
        if (anyState?.pendingPopup && anyState.pendingPopup.id) {
          const p = anyState.pendingPopup as PopupPayload;
          if (!seenPopupIdsRef.current.has(p.id)) {
            seenPopupIdsRef.current.add(p.id);
            setPopupQueue((prev) => [...prev, p]);
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
        if (item.showPopup && !seenPopupIdsRef.current.has(item.id)) {
          seenPopupIdsRef.current.add(item.id);
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
        const p = action.payload;
        if (!seenPopupIdsRef.current.has(p.id)) {
          seenPopupIdsRef.current.add(p.id);
          setPopupQueue((prev) => [...prev, p]);
        }
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

  // Canvas scale management for 512x768 display
  const [scaleMode, setScaleMode] = useState<'fit' | 'fixed'>('fit');
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const handleScale = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (scaleMode === 'fixed') {
        setScale(1);
      } else {
        // Fit while strictly preserving 512:768 aspect ratio
        const scaleX = vw / 512;
        const scaleY = vh / 768;
        setScale(Math.min(scaleX, scaleY));
      }
    };

    handleScale();
    window.addEventListener('resize', handleScale);
    return () => window.removeEventListener('resize', handleScale);
  }, [scaleMode]);

  const backgroundSrc = settings.customBackgroundUrl || '/background.png';

  return (
    <div className="relative w-screen h-screen min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden select-none font-thai">
      {/* 512x768 Screen Stage Canvas */}
      <div
        id="ckp-display-canvas"
        className="relative overflow-hidden flex flex-col items-center justify-between text-slate-800 shadow-2xl transition-transform duration-100 origin-center"
        style={{
          width: '512px',
          height: '768px',
          minWidth: '512px',
          minHeight: '768px',
          maxWidth: '512px',
          maxHeight: '768px',
          transform: `scale(${scale})`,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Official CKP 32nd Anniversary Living Animated Banner */}
        <AnimatedBackground
          imageSrc={backgroundSrc}
          enableParticles={true}
          isCelebrating={currentPopup !== null}
        />

        {/* Top Floating Controls */}
        <div
          className={`absolute top-2.5 right-2.5 z-40 flex items-center gap-1.5 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Real-time Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md backdrop-blur border transition-all ${
              realtimeStatus === 'connected'
                ? 'bg-emerald-950/85 text-emerald-300 border-emerald-400/40'
                : realtimeStatus === 'connecting'
                ? 'bg-amber-950/85 text-amber-300 border-amber-400/40 animate-pulse'
                : 'bg-slate-900/85 text-slate-400 border-slate-700'
            }`}
            title={
              realtimeStatus === 'connected'
                ? '🟢 เชื่อมต่อคลาวด์เรียลไทม์สำเร็จ (<100ms) พร้อมรับ Popup สดข้ามเครื่อง'
                : realtimeStatus === 'connecting'
                ? '🟡 กำลังเชื่อมต่อช่องสัญญาณเรียลไทม์...'
                : '⚪ ออฟไลน์ (ทำงานผ่าน BroadcastChannel ในเบราว์เซอร์)'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                  : realtimeStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-slate-500'
              }`}
            />
            <span>{realtimeStatus === 'connected' ? '⚡ สด <100ms' : realtimeStatus === 'connecting' ? 'กำลังเชื่อม...' : 'ออฟไลน์'}</span>
          </div>

          {/* Resolution Badge & Mode Toggle */}
          <button
            onClick={() => setScaleMode((prev) => (prev === 'fit' ? 'fixed' : 'fit'))}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-950/85 hover:bg-blue-900 text-sky-200 border border-sky-400/40 text-[11px] font-bold shadow-md backdrop-blur transition-all"
            title={`โหมดการแสดงผลปัจจุบัน: ${scaleMode === 'fit' ? 'พอดีหน้าจอ (Fit)' : 'ขนาดจริง 1:1 (Fixed 512x768)'} - คลิกเพื่อสลับ`}
          >
            <span>512×768</span>
            <span className="text-[10px] text-amber-300">
              ({scaleMode === 'fit' ? `${Math.round(scale * 100)}%` : '1:1'})
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className="p-1.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md backdrop-blur border border-white/60 transition-all hover:scale-105"
            title={soundMuted ? 'เปิดเสียงกระดิ่ง' : 'ปิดเสียงกระดิ่ง'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-blue-600" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md backdrop-blur border border-white/60 transition-all hover:scale-105"
            title={isFullscreen ? 'ออกจากเต็มหน้าจอ' : 'เต็มหน้าจอ (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Popout 512x768 Window Button */}
          <button
            onClick={() =>
              window.open(
                window.location.pathname + '?screen=display',
                'CKP_Display_512x768',
                'width=512,height=768,menubar=no,toolbar=no,location=no,status=no'
              )
            }
            className="p-1.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md backdrop-blur border border-white/60 transition-all hover:scale-105"
            title="เปิดในหน้าต่างแยกขนาด 512×768 พิกเซล"
          >
            <Monitor className="w-4 h-4 text-emerald-600" />
          </button>

          {/* Admin Switch */}
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white text-blue-900 shadow-md backdrop-blur transition-all hover:scale-105 border border-white/80"
              title="ไปที่หน้า Admin"
            >
              <Settings className="w-4 h-4 text-blue-600" />
            </button>
          )}

          <button
            onClick={() => window.open(window.location.pathname + '?screen=admin', '_blank')}
            className="p-1.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md backdrop-blur border border-white/60 transition-all hover:scale-105"
            title="เปิดหน้า Admin ในหน้าต่างใหม่"
          >
            <ExternalLink className="w-4 h-4 text-blue-600" />
          </button>
        </div>

        {/* Main Top Header Area */}
        <header className="w-full pt-4 px-4 text-center z-10 flex flex-col items-center">
          <div className="w-full max-w-[472px] px-5 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-white/90 shadow-lg">
            <h1 className="text-2xl font-black text-blue-950 tracking-wide font-display drop-shadow-sm leading-snug">
              {settings.title || 'คณะผ้าป่าเพื่อการศึกษา'}
            </h1>
            {settings.subtitle && (
              <p className="mt-0.5 text-xs font-semibold text-blue-900/80">
                {settings.subtitle}
              </p>
            )}
          </div>
        </header>

        {/* Center Main Stage */}
        <main className="flex-1 flex flex-col items-center justify-center w-full px-4 z-10 my-auto">
          <div className="relative flex flex-col items-center text-center w-full max-w-[472px]">
            {/* Countdown Timer: 12:00 วันเสาร์ที่ 3 ตุลาคม */}
            {settings.countdownEnabled !== false && (
              <CountdownTimer
                targetDate={settings.countdownTargetDate || '2026-10-03T12:00:00'}
                title={settings.countdownTitle || 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.'}
                enabled={true}
                className="mb-3.5 shadow-md transform hover:scale-102 transition-transform"
              />
            )}

            {/* Badge: 💰 ยอดบริจาครวม */}
            <div className="inline-flex items-center gap-2 px-6 py-1.5 rounded-full bg-white/95 text-blue-950 font-black text-lg shadow-md border border-white/90 mb-3 tracking-wide">
              <span className="text-xl">💰</span>
              <span className="font-display">ยอดบริจาครวม</span>
            </div>

            {/* Grand Total Amount Display Plaque */}
            <div className="w-full px-4 py-6 rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl border-2 border-white/90">
              <div className="relative flex items-baseline justify-center font-black tracking-tight leading-none text-blue-950 font-display">
                <CountUp
                  end={total}
                  duration={1200}
                  prefix="฿ "
                  className="text-5xl sm:text-[54px] font-black text-blue-950 drop-shadow-sm tabular-nums whitespace-nowrap"
                />
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Scrolling Donor Ticker */}
        <DonorTicker donations={donations} isPortrait={true} />

        {/* Pop-up Notification for Donors */}
        <DonationPopup
          popup={currentPopup}
          onFinished={handlePopupFinished}
          defaultDuration={settings.popupDurationSeconds}
        />
      </div>
    </div>
  );
};
