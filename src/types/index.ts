export interface DonationItem {
  id: string;
  donorName: string;
  amount: number;
  timestamp: string; // ISO string
  note?: string;
  showPopup: boolean;
}

export interface AppSettings {
  title: string;
  subtitle?: string;
  soundEnabled: boolean;
  popupDurationSeconds: number; // e.g. 5
  customBackgroundUrl?: string; // base64 or custom URL, fallback to default
  currencySymbol: string; // default "฿"
  adminPin?: string; // PIN or password to access Admin panel (default: "1234")
  countdownEnabled?: boolean; // toggle countdown timer on/off
  countdownTargetDate?: string; // ISO/local date string e.g. "2026-10-03T12:00:00"
  countdownTitle?: string; // e.g. "ปิดยอดบริจาค: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น."
}

export interface PopupPayload {
  id: string;
  donorName: string;
  amount: number;
  timestamp: string;
  duration?: number;
}

export type BroadcastAction =
  | { type: 'ADD_DONATION'; payload: DonationItem }
  | { type: 'UPDATE_TOTAL'; payload: number }
  | { type: 'TRIGGER_POPUP'; payload: PopupPayload }
  | { type: 'UPDATE_SETTINGS'; payload: AppSettings }
  | { type: 'DELETE_DONATION'; payload: { id: string; deductedAmount: number } }
  | { type: 'RESET_DATA'; payload: { initialTotal: number; initialTitle: string } }
  | { type: 'SYNC'; payload: { total: number; donations: DonationItem[]; settings: AppSettings } };
