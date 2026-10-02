import { AppSettings, DonationItem } from '../types';

const STORAGE_KEYS = {
  TOTAL: 'ckp_donation_total_v1',
  HISTORY: 'ckp_donation_history_v1',
  SETTINGS: 'ckp_donation_settings_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  title: 'คณะผ้าป่าเพื่อการศึกษา',
  subtitle: '๓๒ ปี โรงเรียนชำฆ้อพิทยาคม จ.ระยอง',
  soundEnabled: true,
  popupDurationSeconds: 5,
  currencySymbol: '฿',
  adminPin: '1234',
  countdownEnabled: true,
  countdownTargetDate: '2026-10-03T12:00:00',
  countdownTitle: 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.',
};

const DEFAULT_SAMPLE_DONATIONS: DonationItem[] = [
  {
    id: 'sample-1',
    donorName: 'คุณสมชาย ใจดี',
    amount: 5000,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    showPopup: true,
    note: 'กองบุญเพื่อทุนการศึกษา',
  },
  {
    id: 'sample-2',
    donorName: 'คุณวิภา และครอบครัวรัตนศิริ',
    amount: 10000,
    timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    showPopup: true,
    note: 'ร่วมสมทบทุนจัดซื้ออุปกรณ์การเรียน',
  },
  {
    id: 'sample-3',
    donorName: 'ผู้ไม่ประสงค์ออกนาม',
    amount: 2500,
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    showPopup: false,
  },
  {
    id: 'sample-4',
    donorName: 'คณะศิษย์เก่า รุ่นที่ ๑๒',
    amount: 50000,
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    showPopup: true,
    note: 'ประธานสายผ้าป่า',
  },
];

export function getStoredTotal(): number {
  const val = localStorage.getItem(STORAGE_KEYS.TOTAL);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num)) return num;
  }
  return 67500; // Default matching user's prompt
}

export function saveStoredTotal(total: number): void {
  localStorage.setItem(STORAGE_KEYS.TOTAL, total.toString());
}

export function getStoredHistory(): DonationItem[] {
  const val = localStorage.getItem(STORAGE_KEYS.HISTORY);
  if (val) {
    try {
      return JSON.parse(val);
    } catch {
      // fallback
    }
  }
  return DEFAULT_SAMPLE_DONATIONS;
}

export function saveStoredHistory(history: DonationItem[]): void {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export function getStoredSettings(): AppSettings {
  const val = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (val) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(val) };
    } catch {
      // fallback
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveStoredSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function resetAllStorage(initialTotal: number = 0, initialTitle: string = 'คณะผ้าป่าเพื่อการศึกษา'): void {
  saveStoredTotal(initialTotal);
  saveStoredHistory([]);
  saveStoredSettings({
    ...DEFAULT_SETTINGS,
    title: initialTitle,
  });
}
