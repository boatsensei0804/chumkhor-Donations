import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  MinusCircle,
  Edit3,
  UserPlus,
  History,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Monitor,
  Download,
  Trash2,
  CheckCircle,
  Volume2,
  VolumeX,
  BellRing,
  LogOut,
  KeyRound,
  Image as ImageIcon,
  Clock,
} from 'lucide-react';
import { DonationItem, AppSettings, BroadcastAction } from '../types';
import {
  getStoredHistory,
  getStoredSettings,
  getStoredTotal,
  saveStoredHistory,
  saveStoredSettings,
  saveStoredTotal,
  resetAllStorage,
} from '../utils/storage';
import { syncChannel } from '../utils/channel';
import { apiFetchState, apiAddDonation, apiDeleteDonation, apiUpdateTotal, apiUpdateSettings, apiTriggerPopup, apiReset } from '../utils/api';

interface AdminScreenProps {
  onOpenDisplay?: () => void;
  onLogout?: () => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({ onOpenDisplay, onLogout }) => {
  const [total, setTotal] = useState<number>(getStoredTotal);
  const [history, setHistory] = useState<DonationItem[]>(getStoredHistory);
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings);

  // Form State: Add Donation
  const [donorName, setDonorName] = useState('');
  const [donationAmount, setDonationAmount] = useState<string>('');
  const [donationNote, setDonationNote] = useState('');
  const [showPopup, setShowPopup] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State: Direct Total Edit
  const [manualTotal, setManualTotal] = useState<string>(getStoredTotal().toString());

  // Form State: Quick Add / Deduct
  const [adjustAmount, setAdjustAmount] = useState<string>('');

  // Settings State
  const [ceremonyTitle, setCeremonyTitle] = useState(settings.title);
  const [popupDuration, setPopupDuration] = useState(settings.popupDurationSeconds);
  const [adminPin, setAdminPin] = useState(settings.adminPin || '1234');
  const [selectedBackground, setSelectedBackground] = useState<string>(settings.customBackgroundUrl || '/background.png');
  const [countdownEnabled, setCountdownEnabled] = useState<boolean>(settings.countdownEnabled !== false);
  const [countdownTargetDate, setCountdownTargetDate] = useState<string>(settings.countdownTargetDate || '2026-10-03T12:00:00');
  const [countdownTitle, setCountdownTitle] = useState<string>(settings.countdownTitle || 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.');

  // Confirmation Modals
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetInitialTotal, setResetInitialTotal] = useState<string>('0');

  // Flash success message with proper cleanup
  const successTimeoutRef = React.useRef<number | null>(null);
  const triggerSuccess = React.useCallback((msg: string) => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }
    setSuccessMessage(msg);
    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
      successTimeoutRef.current = null;
    }, 3500);
  }, []);

  // Cleanup success timer on unmount
  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Sync with other windows
  useEffect(() => {
    const unsubscribe = syncChannel.subscribe((action: BroadcastAction) => {
      if (action.type === 'UPDATE_TOTAL') {
        setTotal(action.payload);
        setManualTotal(action.payload.toString());
      } else if (action.type === 'ADD_DONATION') {
        setTotal((prev) => prev + action.payload.amount);
        setHistory((prev) => [action.payload, ...prev]);
        setManualTotal((prev) => (parseFloat(prev || '0') + action.payload.amount).toString());
      } else if (action.type === 'UPDATE_SETTINGS') {
        setSettings(action.payload);
        setCeremonyTitle(action.payload.title);
        setPopupDuration(action.payload.popupDurationSeconds);
      } else if (action.type === 'DELETE_DONATION') {
        setTotal((prev) => Math.max(0, prev - action.payload.deductedAmount));
        setHistory((prev) => prev.filter((item) => item.id !== action.payload.id));
      } else if (action.type === 'RESET_DATA') {
        setTotal(action.payload.initialTotal);
        setManualTotal(action.payload.initialTotal.toString());
        setHistory([]);
      } else if (action.type === 'SYNC') {
        setTotal(action.payload.total);
        setManualTotal(action.payload.total.toString());
        setHistory(action.payload.donations);
        setSettings(action.payload.settings);
        setCeremonyTitle(action.payload.settings.title);
        setPopupDuration(action.payload.settings.popupDurationSeconds);
        if (action.payload.settings.countdownEnabled !== undefined) {
          setCountdownEnabled(action.payload.settings.countdownEnabled);
        }
        if (action.payload.settings.countdownTargetDate) {
          setCountdownTargetDate(action.payload.settings.countdownTargetDate);
        }
        if (action.payload.settings.countdownTitle) {
          setCountdownTitle(action.payload.settings.countdownTitle);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch initial state from server API
  useEffect(() => {
    apiFetchState()
      .then((state) => {
        setTotal(state.total);
        setManualTotal(state.total.toString());
        setHistory(state.donations);
        setSettings(state.settings);
        setCeremonyTitle(state.settings.title);
        setPopupDuration(state.settings.popupDurationSeconds);
        setAdminPin(state.settings.adminPin || '1234');
        setSelectedBackground(state.settings.customBackgroundUrl || '/background.png');
        if (state.settings.countdownEnabled !== undefined) {
          setCountdownEnabled(state.settings.countdownEnabled);
        }
        if (state.settings.countdownTargetDate) {
          setCountdownTargetDate(state.settings.countdownTargetDate);
        }
        if (state.settings.countdownTitle) {
          setCountdownTitle(state.settings.countdownTitle);
        }
      })
      .catch(() => {});
  }, []);

  // 1. Add Donation
  const handleAddDonation = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(donationAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }

    const newItem: DonationItem = {
      id: 'don_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      donorName: donorName.trim() || 'ผู้มีจิตศรัทธา',
      amount: amountNum,
      timestamp: new Date().toISOString(),
      note: donationNote.trim() || undefined,
      showPopup,
    };

    const newHistory = [newItem, ...history];
    const newTotal = total + amountNum;

    setHistory(newHistory);
    setTotal(newTotal);
    setManualTotal(newTotal.toString());

    // Save to local storage for offline / GitHub Pages static hosting
    saveStoredHistory(newHistory);
    saveStoredTotal(newTotal);

    // Broadcast across browser tabs
    syncChannel.postMessage({
      type: 'ADD_DONATION',
      payload: newItem,
    });
    if (showPopup) {
      syncChannel.postMessage({
        type: 'TRIGGER_POPUP',
        payload: {
          id: newItem.id,
          donorName: newItem.donorName,
          amount: newItem.amount,
          timestamp: newItem.timestamp,
          duration: settings.popupDurationSeconds,
        },
      });
    }

    // Save to server API if available
    apiAddDonation(newItem).catch(() => {});

    triggerSuccess(`บันทึกยอดเงินจาก "${newItem.donorName}" เรียบร้อยแล้ว (฿${amountNum.toLocaleString('th-TH')})`);
    setDonorName('');
    setDonationAmount('');
    setDonationNote('');
  };

  // Quick Amount preset buttons for Donation Form
  const addQuickPreset = (val: number) => {
    const current = parseFloat(donationAmount) || 0;
    setDonationAmount((current + val).toString());
  };

  // 2. Adjust Total (Add / Deduct)
  const handleQuickAdjust = (type: 'ADD' | 'DEDUCT') => {
    const val = parseFloat(adjustAmount);
    if (isNaN(val) || val <= 0) {
      alert('กรุณากรอกจำนวนเงินที่ต้องการปรับ');
      return;
    }

    const newTotal = type === 'ADD' ? total + val : Math.max(0, total - val);
    setTotal(newTotal);
    setManualTotal(newTotal.toString());
    saveStoredTotal(newTotal);

    syncChannel.postMessage({
      type: 'UPDATE_TOTAL',
      payload: newTotal,
    });

    apiUpdateTotal(newTotal).catch(() => {});

    triggerSuccess(`${type === 'ADD' ? 'เพิ่มยอด' : 'ลดยอด'} ฿${val.toLocaleString('th-TH')} สำเร็จ (ยอดใหม่: ฿${newTotal.toLocaleString('th-TH')})`);
    setAdjustAmount('');
  };

  // 3. Direct Edit Total
  const handleDirectEditTotal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualTotal);
    if (isNaN(val) || val < 0) {
      alert('กรุณากรอกยอดเงินรวมที่ถูกต้อง');
      return;
    }

    setTotal(val);
    saveStoredTotal(val);

    syncChannel.postMessage({
      type: 'UPDATE_TOTAL',
      payload: val,
    });

    apiUpdateTotal(val).catch(() => {});

    triggerSuccess(`แก้ไขยอดบริจาครวมโดยตรงเป็น ฿${val.toLocaleString('th-TH')} สำเร็จ`);
  };

  // 4. Trigger Popup Again for History Item
  const handleReTriggerPopup = (item: DonationItem) => {
    const payload = {
      id: item.id,
      donorName: item.donorName,
      amount: item.amount,
      timestamp: item.timestamp,
      duration: settings.popupDurationSeconds,
    };

    syncChannel.postMessage({
      type: 'TRIGGER_POPUP',
      payload,
    });

    apiTriggerPopup(payload).catch(() => {});
    triggerSuccess(`ส่งแจ้งเตือนของ "${item.donorName}" ไปยังหน้าจอ Display แล้ว`);
  };

  // 5. Delete History Item
  const handleDeleteItem = (item: DonationItem) => {
    const deduct = window.confirm(
      `คุณต้องการลบรายการของ "${item.donorName}" (฿${item.amount.toLocaleString('th-TH')}) หรือไม่?\n\nกด "ตกลง" เพื่อลบและหักลดยอดรวม\nกด "ยกเลิก" หากไม่ต้องการลบ`
    );
    if (!deduct) return;

    const newHistory = history.filter((h) => h.id !== item.id);
    const newTotal = Math.max(0, total - item.amount);

    setHistory(newHistory);
    setTotal(newTotal);
    setManualTotal(newTotal.toString());
    saveStoredHistory(newHistory);
    saveStoredTotal(newTotal);

    syncChannel.postMessage({
      type: 'DELETE_DONATION',
      payload: { id: item.id, deductedAmount: item.amount },
    });

    apiDeleteDonation(item.id).catch(() => {});

    triggerSuccess(`ลบรายการและปรับยอดยกออก ฿${item.amount.toLocaleString('th-TH')} แล้ว`);
  };

  // 6. Test Popup
  const handleTestPopup = () => {
    const testPayload = {
      id: 'test-' + Date.now(),
      donorName: 'คุณสมชาย ใจดี (ทดสอบระบบ)',
      amount: 5000,
      timestamp: new Date().toISOString(),
      duration: settings.popupDurationSeconds,
    };

    syncChannel.postMessage({
      type: 'TRIGGER_POPUP',
      payload: testPayload,
    });

    apiTriggerPopup(testPayload).catch(() => {});
    triggerSuccess('ส่งแจ้งเตือนทดสอบไปยังหน้าจอ Display แล้ว');
  };

  // 7. Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppSettings = {
      ...settings,
      title: ceremonyTitle.trim() || 'คณะผ้าป่าเพื่อการศึกษา',
      popupDurationSeconds: Math.max(2, Math.min(30, popupDuration)),
      adminPin: adminPin.trim() || '1234',
      customBackgroundUrl: selectedBackground,
      countdownEnabled,
      countdownTargetDate,
      countdownTitle: countdownTitle.trim() || 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.',
    };
    setSettings(updated);
    saveStoredSettings(updated);

    syncChannel.postMessage({
      type: 'UPDATE_SETTINGS',
      payload: updated,
    });

    apiUpdateSettings(updated).catch(() => {});

    triggerSuccess('บันทึกการตั้งค่าเรียบร้อยแล้ว');
  };

  // Toggle Sound in Settings
  const toggleSound = () => {
    const updated = { ...settings, soundEnabled: !settings.soundEnabled };
    setSettings(updated);
    saveStoredSettings(updated);

    syncChannel.postMessage({
      type: 'UPDATE_SETTINGS',
      payload: updated,
    });

    apiUpdateSettings(updated).catch(() => {});
  };

  // 8. Reset All Data
  const handleExecuteReset = () => {
    const initTotal = parseFloat(resetInitialTotal) || 0;
    setTotal(initTotal);
    setManualTotal(initTotal.toString());
    setHistory([]);
    setIsResetModalOpen(false);

    resetAllStorage(initTotal, settings.title);

    syncChannel.postMessage({
      type: 'RESET_DATA',
      payload: { initialTotal: initTotal, initialTitle: settings.title },
    });

    apiReset(initTotal, settings.title).catch(() => {});

    triggerSuccess(`รีเซ็ตข้อมูลทั้งหมดแล้ว ยอดเริ่มต้นคือ ฿${initTotal.toLocaleString('th-TH')}`);
  };

  // 9. Export to CSV
  const handleExportCSV = () => {
    if (history.length === 0) {
      alert('ไม่มีรายการบริจาคให้ดาวน์โหลด');
      return;
    }

    const header = 'ลำดับ,วันเวลา,ชื่อผู้บริจาค,จำนวนเงิน(บาท),หมายเหตุ\n';
    const rows = history
      .map((item, index) => {
        const time = new Date(item.timestamp).toLocaleString('th-TH');
        const cleanName = `"${item.donorName.replace(/"/g, '""')}"`;
        const cleanNote = item.note ? `"${item.note.replace(/"/g, '""')}"` : '""';
        return `${history.length - index},"${time}",${cleanName},${item.amount},${cleanNote}`;
      })
      .join('\n');

    const bom = '\uFEFF'; // UTF-8 BOM for Excel in Thai
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `รายการบริจาค_ผ้าป่าเพื่อการศึกษา_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16 font-thai">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-lg">⚙️</span>
            <div>
              <h1 className="font-bold text-lg sm:text-xl text-amber-300">ระบบควบคุม (Admin Dashboard)</h1>
              <p className="text-xs text-slate-400">จัดการยอดเงินและผู้บริจาค ผ้าป่าเพื่อการศึกษา</p>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleTestPopup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs sm:text-sm font-medium border border-slate-700 transition"
              title="ทดสอบแสดงผล Popup บนหน้าจอ Display"
            >
              <BellRing className="w-4 h-4" />
              <span>ทดสอบ Popup</span>
            </button>

            {onOpenDisplay && (
              <button
                onClick={onOpenDisplay}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-medium shadow transition"
              >
                <Monitor className="w-4 h-4" />
                <span>ดูหน้าจอ Display</span>
              </button>
            )}

            <button
              onClick={() => window.open(window.location.pathname + '?screen=display', '_blank')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs sm:text-sm font-bold shadow transition"
              title="เปิดหน้าจอ Display ในแท็บหรือหน้าต่างใหม่เพื่อนำขึ้นโปรเจกเตอร์"
            >
              <ExternalLink className="w-4 h-4" />
              <span>เปิดจอแสดงผล (โปรเจกเตอร์)</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 text-xs sm:text-sm font-medium border border-slate-700 transition"
                title="ออกจากระบบการจัดการ"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Success Alert Banner */}
      {successMessage && (
        <div className="max-w-7xl mx-auto mt-4 px-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 shadow-sm animate-popup-in">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm sm:text-base font-semibold">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto mt-6 px-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Direct Edit (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Current Total Summary Card */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs sm:text-sm text-sky-200 font-medium">💰 ยอดเงินบริจาครวมขณะนี้</p>
                <h2 className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight mt-1">
                  ฿ {total.toLocaleString('th-TH')}
                </h2>
                <p className="text-xs text-slate-300 mt-2">
                  ซิงค์แบบ Real-time กับหน้าจอแสดงผลอัตโนมัติ
                </p>
              </div>

              {/* Sound status indicator */}
              <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur">
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-xs font-medium text-slate-200">
                  {settings.soundEnabled ? 'เปิดเสียงกระดิ่ง' : 'ปิดเสียง'}
                </span>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="ml-2 text-xs text-amber-300 underline hover:text-white"
                >
                  สลับ
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 1: เพิ่มชื่อผู้บริจาค & กรอกจำนวนเงิน */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-md border border-slate-200">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
              <UserPlus className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-800">บันทึกยอดเงินบริจาคใหม่</h2>
            </div>

            <form onSubmit={handleAddDonation} className="space-y-4">
              {/* Donor Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  ชื่อผู้บริจาค <span className="text-xs font-normal text-slate-400">(เว้นว่างเพื่อใช้ "ผู้มีจิตศรัทธา")</span>
                </label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="เช่น คุณสมชาย ใจดี, คณะศิษย์เก่า, ครอบครัวบุญมี"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                />
              </div>

              {/* Donation Amount */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  จำนวนเงินบริจาค (บาท) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold text-lg">฿</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)}
                    placeholder="เช่น 5000"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-bold text-slate-800"
                  />
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <span className="text-xs text-slate-500 self-center">ปุ่มลัด:</span>
                  {[100, 500, 1000, 2000, 5000, 10000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => addQuickPreset(val)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition"
                    >
                      +{val.toLocaleString()}
                    </button>
                  ))}
                  {donationAmount && (
                    <button
                      type="button"
                      onClick={() => setDonationAmount('')}
                      className="px-2 py-1 text-xs text-red-500 hover:text-red-700 ml-auto"
                    >
                      ล้างยอด
                    </button>
                  )}
                </div>
              </div>

              {/* Note / Message */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  หมายเหตุ / สายบุญ <span className="text-xs font-normal text-slate-400">(ระบุหรือไม่ก็ได้)</span>
                </label>
                <input
                  type="text"
                  value={donationNote}
                  onChange={(e) => setDonationNote(e.target.value)}
                  placeholder="เช่น สายอาจารย์สมศรี, กองทุนห้องสมุด"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Toggle Show Popup on Display */}
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-950">แสดงแจ้งเตือน Popup บนหน้าจอ Display</p>
                    <p className="text-xs text-amber-700">แสดงกล่องข้อความขอขอบพระคุณกลางจอพร้อมเสียงกระดิ่ง</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPopup}
                    onChange={(e) => setShowPopup(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-600 hover:to-yellow-600 text-amber-950 font-black text-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-5 h-5" />
                <span>บันทึกและแสดงยอดบริจาค</span>
              </button>
            </form>
          </div>

          {/* SECTION 2: จัดการยอดเงินโดยตรง & ปรับยอดด่วน */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct Total Edit */}
            <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800">แก้ยอดรวมโดยตรง</h3>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  กำหนดตัวเลขยอดเงินบริจาครวมสุทธิทันที (เหมาะสำหรับพิมพ์ยอดนับสด)
                </p>
              </div>

              <form onSubmit={handleDirectEditTotal} className="space-y-3">
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">฿</span>
                  <input
                    type="number"
                    step="any"
                    value={manualTotal}
                    onChange={(e) => setManualTotal(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow transition"
                >
                  บันทึกยอดรวมใหม่
                </button>
              </form>
            </div>

            {/* Quick Adjust (Add / Deduct) */}
            <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <PlusCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800">เพิ่มยอด / ลดยอด</h3>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  บวกหรือหักออกจากยอดรวมปัจจุบันโดยตรง
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">฿</span>
                  <input
                    type="number"
                    step="any"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="จำนวนเงิน"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-base font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust('ADD')}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 shadow transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>เพิ่มยอด (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust('DEDUCT')}
                    className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 shadow transition"
                  >
                    <MinusCircle className="w-4 h-4" />
                    <span>ลดยอด (-)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: History & Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* SECTION 3: ประวัติรายการบริจาค */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-800">ประวัติรายการบริจาค</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                  {history.length} รายการ
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                title="ดาวน์โหลดไฟล์ CSV สำหรับ Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
              {history.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  ยังไม่มีรายการบริจาค
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate text-sm">
                        {item.donorName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-bold text-blue-700">
                          ฿{item.amount.toLocaleString('th-TH')}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(item.timestamp).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.note && (
                          <>
                            <span>•</span>
                            <span className="truncate text-slate-400 max-w-[120px]">{item.note}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleReTriggerPopup(item)}
                        className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition"
                        title="ยิงแจ้งเตือน Popup ซ้ำขึ้นจอ"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-2 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 4: การตั้งค่าระบบ */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
            <h2 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <span>🛠️ การตั้งค่าการแสดงผล</span>
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  หัวข้อชื่อคณะ / ชื่องาน
                </label>
                <input
                  type="text"
                  value={ceremonyTitle}
                  onChange={(e) => setCeremonyTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ระยะเวลาแสดง Popup แจ้งเตือน (วินาที)
                </label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={popupDuration}
                  onChange={(e) => setPopupDuration(parseInt(e.target.value) || 5)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Countdown Timer Settings */}
              <div className="p-3.5 rounded-xl bg-sky-50/80 border border-sky-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-700" />
                    <div>
                      <p className="text-xs font-bold text-sky-950">เวลานับถอยหลัง (Countdown)</p>
                      <p className="text-[11px] text-sky-700">แสดงเวลานับถอยหลังถึงวันปิดยอดบนหน้าจอแสดงผล</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={countdownEnabled}
                      onChange={(e) => setCountdownEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>

                {countdownEnabled && (
                  <div className="space-y-2 pt-2 border-t border-sky-200/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        วันและเวลากำหนดปิดยอด (เสาร์ 3 ต.ค. 12:00)
                      </label>
                      <input
                        type="datetime-local"
                        value={countdownTargetDate ? countdownTargetDate.slice(0, 16) : '2026-10-03T12:00'}
                        onChange={(e) => setCountdownTargetDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        ข้อความกำกับหัวเวลานับถอยหลัง
                      </label>
                      <input
                        type="text"
                        value={countdownTitle}
                        onChange={(e) => setCountdownTitle(e.target.value)}
                        placeholder="เช่น นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  รหัสผ่านเข้าสู่ระบบ Admin (PIN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="เช่น 1234"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">ใช้สำหรับป้องกันผู้ไม่เกี่ยวข้องเข้าถึงหน้าควบคุม (ค่าเริ่มต้น: 1234)</p>
              </div>

              {/* Background Theme Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>เลือกภาพพื้นหลังหน้าจอแสดงผล</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBackground('/background.png')}
                    className={`p-2 rounded-xl text-left border text-xs transition ${
                      selectedBackground === '/background.png' || !selectedBackground
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold ring-2 ring-amber-300'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block font-bold">🐘 ป้ายโรงเรียน CKP (HD)</span>
                    <span className="text-[10px] text-slate-500">ช้างแบกฉัตร ฟ้า-ขาว-ทอง</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBackground('/background_ckp.jpg')}
                    className={`p-2 rounded-xl text-left border text-xs transition ${
                      selectedBackground === '/background_ckp.jpg'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold ring-2 ring-amber-300'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block font-bold">📷 ภาพต้นฉบับ</span>
                    <span className="text-[10px] text-slate-500">ขนาดเล็ก (101KB)</span>
                  </button>
                </div>

                <div className="relative">
                  <label className="block text-[11px] text-slate-500 mb-1">หรืออัปโหลดรูปภาพของคุณเอง:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setSelectedBackground(event.target.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm transition"
                >
                  บันทึกการตั้งค่า
                </button>

                {/* Reset button */}
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตข้อมูลทั้งหมด</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 animate-popup-in">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">ยืนยันการรีเซ็ตข้อมูล?</h3>
            <p className="text-sm text-slate-600 mb-4">
              การดำเนินการนี้จะล้างประวัติรายการบริจาคทั้งหมด และตั้งค่ายอดรวมเริ่มต้นใหม่
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                กำหนดยอดเริ่มต้นหลังรีเซ็ต (บาท)
              </label>
              <input
                type="number"
                value={resetInitialTotal}
                onChange={(e) => setResetInitialTotal(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition shadow"
              >
                ยืนยันการรีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
