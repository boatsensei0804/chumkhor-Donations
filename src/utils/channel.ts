import { BroadcastAction } from '../types';

const CHANNEL_NAME = 'ckp_ceremony_channel';

class SyncChannel {
  private bcChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private listeners: ((action: BroadcastAction) => void)[] = [];
  private wsReconnectTimer: number | null = null;

  constructor() {
    // BroadcastChannel for same-browser tab sync (instant)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bcChannel = new BroadcastChannel(CHANNEL_NAME);
        this.bcChannel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    // WebSocket for cross-device sync via server
    this.connectWebSocket();
  }

  private connectWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const action = JSON.parse(event.data) as BroadcastAction;
          this.notifyListeners(action);
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        // Auto-reconnect after 2 seconds
        if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = window.setTimeout(() => {
          this.connectWebSocket();
        }, 2000);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }
  }

  private notifyListeners(action: BroadcastAction) {
    this.listeners.forEach((listener) => {
      try {
        listener(action);
      } catch (err) {
        console.error('Error in channel listener:', err);
      }
    });
  }

  // Broadcast locally (same browser tabs only)
  postMessage(action: BroadcastAction) {
    if (this.bcChannel) {
      try {
        this.bcChannel.postMessage(action);
      } catch (err) {
        console.error('postMessage error:', err);
      }
    }
  }

  subscribe(callback: (action: BroadcastAction) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }
}

export const syncChannel = new SyncChannel();
