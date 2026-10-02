import { DonationItem, AppSettings, PopupPayload } from '../types';

const API = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ===== State =====
export interface FullState {
  total: number;
  donations: DonationItem[];
  settings: AppSettings;
}

export function apiFetchState(): Promise<FullState> {
  return request<FullState>('/state');
}

// ===== Donations =====
export function apiAddDonation(item: DonationItem): Promise<FullState> {
  return request<FullState>('/donations', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export function apiDeleteDonation(id: string): Promise<FullState> {
  return request<FullState>(`/donations/${id}`, { method: 'DELETE' });
}

// ===== Total =====
export function apiUpdateTotal(total: number): Promise<FullState> {
  return request<FullState>('/total', {
    method: 'PUT',
    body: JSON.stringify({ total }),
  });
}

// ===== Settings =====
export function apiFetchSettings(): Promise<AppSettings> {
  return request<AppSettings>('/settings');
}

export function apiUpdateSettings(settings: AppSettings): Promise<AppSettings> {
  return request<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ===== Popup =====
export function apiTriggerPopup(payload: PopupPayload): Promise<void> {
  return request('/trigger-popup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ===== Reset =====
export function apiReset(initialTotal: number, initialTitle: string): Promise<FullState> {
  return request<FullState>('/reset', {
    method: 'POST',
    body: JSON.stringify({ initialTotal, initialTitle }),
  });
}
