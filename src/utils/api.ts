import { DonationItem, AppSettings, PopupPayload } from '../types';
import { syncChannel } from './channel';

export const GOOGLE_SCRIPT_STORAGE_KEY = 'ckp_gas_web_app_url';

export function getGoogleScriptUrl(): string {
  if (typeof window !== 'undefined') {
    // Check URL query parameters first (e.g. ?gasUrl=https://script.google.com/...)
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('gasUrl');
      if (urlParam && urlParam.trim()) {
        const clean = decodeURIComponent(urlParam.trim());
        localStorage.setItem(GOOGLE_SCRIPT_STORAGE_KEY, clean);
        return clean;
      }
    } catch {}

    const saved = localStorage.getItem(GOOGLE_SCRIPT_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  const meta = import.meta as unknown as { env?: Record<string, string> };
  return meta.env?.VITE_GOOGLE_SCRIPT_URL || '';
}

export function setGoogleScriptUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem(GOOGLE_SCRIPT_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(GOOGLE_SCRIPT_STORAGE_KEY);
    }
  }
}

const API = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Helper to call Google Apps Script for Google Sheets operations
async function callGoogleScript(action: string, payload: Record<string, any> = {}): Promise<FullState> {
  const gasUrl = getGoogleScriptUrl();
  if (!gasUrl) throw new Error('No Google Script URL configured');

  // Try POST with text/plain (avoids CORS preflight)
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    // If POST fails, fallback to GET query parameters
  }

  const params = new URLSearchParams({
    action,
    ...Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
    ),
  });
  const sep = gasUrl.includes('?') ? '&' : '?';
  const res = await fetch(`${gasUrl}${sep}${params.toString()}`);
  if (!res.ok) throw new Error(`Google Script request failed: ${res.status}`);
  return res.json();
}

// ===== State =====
export interface FullState {
  total: number;
  donations: DonationItem[];
  settings: AppSettings;
  sheetUrl?: string;
  timestamp?: string;
}

export async function apiFetchState(): Promise<FullState> {
  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    const sep = gasUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${gasUrl}${sep}api=state&_t=${Date.now()}`);
    if (!res.ok) throw new Error(`Google Script fetch error: ${res.status}`);
    return res.json();
  }
  return request<FullState>('/state');
}

export async function apiTestConnection(customUrl?: string): Promise<{ success: boolean; message: string; state?: FullState }> {
  const targetUrl = (customUrl !== undefined ? customUrl : getGoogleScriptUrl()).trim();
  if (!targetUrl) {
    return { success: false, message: 'ยังไม่ได้ระบุ URL ของ Google Apps Script' };
  }
  try {
    const sep = targetUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${targetUrl}${sep}api=state&_t=${Date.now()}`);
    if (!res.ok) {
      return { success: false, message: `เซิร์ฟเวอร์ตอบกลับรหัส: ${res.status}` };
    }
    const state: FullState = await res.json();
    return {
      success: true,
      message: `เชื่อมต่อสำเร็จ! พบข้อมูล ${state.donations?.length ?? 0} รายการ, ยอดรวม ฿${(state.total ?? 0).toLocaleString('th-TH')}`,
      state,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `เชื่อมต่อไม่สำเร็จ (${err?.message || 'โปรดตรวจสอบสิทธิ์ Anyone หรือ URL'})`,
    };
  }
}

// ===== Donations =====
export async function apiAddDonation(item: DonationItem): Promise<FullState> {
  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    return callGoogleScript('addDonation', {
      donorName: item.donorName,
      amount: item.amount,
      note: item.note || '',
      showPopup: item.showPopup,
    });
  }
  return request<FullState>('/donations', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function apiDeleteDonation(id: string): Promise<FullState> {
  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    return callGoogleScript('deleteDonation', { id });
  }
  return request<FullState>(`/donations/${id}`, { method: 'DELETE' });
}

// ===== Total =====
export async function apiUpdateTotal(total: number): Promise<FullState> {
  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    return callGoogleScript('updateTotal', { total });
  }
  return request<FullState>('/total', {
    method: 'PUT',
    body: JSON.stringify({ total }),
  });
}

// ===== Settings =====
export async function apiFetchSettings(): Promise<AppSettings> {
  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    const state = await apiFetchState();
    return state.settings;
  }
  return request<AppSettings>('/settings');
}

export async function apiUpdateSettings(settings: AppSettings): Promise<AppSettings> {
  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    const res = await callGoogleScript('updateSettings', { settings });
    return res.settings || settings;
  }
  return request<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ===== Popup =====
export function apiTriggerPopup(payload: PopupPayload): Promise<void> {
  // Always broadcast via instant cloud real-time channel (< 50-100ms)
  syncChannel.postMessage({
    type: 'TRIGGER_POPUP',
    payload,
  });

  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    callGoogleScript('triggerPopup', { popup: payload }).catch(() => {});
    return Promise.resolve();
  }
  return request('/trigger-popup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ===== Reset =====
export async function apiReset(initialTotal: number, initialTitle: string): Promise<FullState> {
  const gasUrl = getGoogleScriptUrl();
  if (gasUrl) {
    return callGoogleScript('resetData', { initialTotal, initialTitle });
  }
  return request<FullState>('/reset', {
    method: 'POST',
    body: JSON.stringify({ initialTotal, initialTitle }),
  });
}
