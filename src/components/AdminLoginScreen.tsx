import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { AnimatedBackground } from './AnimatedBackground';
import { getStoredSettings } from '../utils/storage';
import { apiFetchSettings } from '../utils/api';

interface AdminLoginScreenProps {
  onSuccess: () => void;
  onBackToDisplay: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onSuccess,
  onBackToDisplay,
}) => {
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [settings] = useState(getStoredSettings);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError(true);
      setErrorMessage('กรุณากรอกรหัสผ่าน');
      return;
    }

    // Try API first for latest PIN, fallback to localStorage
    let correctPin = '1234';
    try {
      const serverSettings = await apiFetchSettings();
      correctPin = serverSettings.adminPin || '1234';
    } catch {
      const localSettings = getStoredSettings();
      correctPin = localSettings.adminPin || '1234';
    }
    if (pin.trim() === correctPin.trim()) {
      setError(false);
      sessionStorage.setItem('ckp_admin_auth', 'true');
      onSuccess();
    } else {
      setError(true);
      setErrorMessage('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      setPin('');
    }
  };

  const handleNumpad = (digit: string) => {
    setError(false);
    if (digit === 'CLEAR') {
      setPin('');
    } else if (digit === 'BACKSPACE') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      if (pin.length < 12) {
        setPin((prev) => prev + digit);
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden font-thai select-none">
      {/* Animated Blue-White Looping Background */}
      <AnimatedBackground imageSrc={settings.customBackgroundUrl || '/background.png'} />

      {/* Main Glassmorphic Login Card: Clean Blue-White Style */}
      <div
        className={`relative z-10 w-full max-w-md mx-auto rounded-3xl bg-white/95 backdrop-blur-xl p-8 sm:p-9 shadow-2xl border-2 border-white/90 ${
          error ? 'animate-shake' : ''
        }`}
      >
        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-sky-600 to-blue-600 text-white shadow-lg mb-3">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-blue-950 tracking-tight font-display">
            เข้าสู่ระบบการจัดการ
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {settings.title || 'คณะผ้าป่าเพื่อการศึกษา'}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              รหัสผ่าน / PIN ผู้ดูแลระบบ
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-5 h-5 text-sky-600" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setError(false);
                  setPin(e.target.value);
                }}
                autoFocus
                placeholder="กรอกรหัสผ่าน (เริ่มต้น: 1234)"
                className={`w-full pl-11 pr-12 py-3 rounded-2xl border text-center text-lg sm:text-xl font-bold tracking-widest bg-slate-50/90 focus:bg-white transition focus:outline-none focus:ring-2 ${
                  error
                    ? 'border-red-400 focus:ring-red-500 text-red-700'
                    : 'border-slate-300 focus:ring-blue-600 text-blue-950'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <p className="mt-2 text-xs font-semibold text-red-600 text-center animate-popup-in">
                ⚠️ {errorMessage}
              </p>
            )}
          </div>

          {/* Quick Virtual Numpad */}
          <div className="pt-2">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => {
                const isClear = btn === 'C';
                const isBackspace = btn === '⌫';
                return (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (isClear) handleNumpad('CLEAR');
                      else if (isBackspace) handleNumpad('BACKSPACE');
                      else handleNumpad(btn);
                    }}
                    className={`py-3 rounded-xl font-bold text-base sm:text-lg transition active:scale-95 shadow-sm border ${
                      isClear
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : isBackspace
                        ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-sky-50 hover:border-sky-300 hover:text-blue-900'
                    }`}
                  >
                    {btn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-700 via-sky-600 to-blue-700 hover:from-blue-800 hover:to-sky-700 text-white font-black text-base sm:text-lg shadow-lg hover:shadow-xl transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>เข้าสู่ระบบ (Login)</span>
          </button>
        </form>

        {/* Back to Display Screen Button */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 text-center">
          <button
            type="button"
            onClick={onBackToDisplay}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-900 transition hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่หน้าจอแสดงผลยอดบริจาค (Display)</span>
          </button>
        </div>

        {/* Default Password Hint */}
        <p className="mt-4 text-[11px] text-center text-slate-400">
          💡 รหัสผ่านเริ่มต้นคือ <span className="font-bold text-slate-600">1234</span>
        </p>
      </div>
    </div>
  );
};
