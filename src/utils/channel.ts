import { BroadcastAction } from '../types';

const LOCAL_CHANNEL_NAME = 'ckp_ceremony_channel';
export const DEFAULT_REALTIME_TOPIC = 'ckp-chumkhor-donations-2026';
export const REALTIME_TOPIC_STORAGE_KEY = 'ckp_realtime_topic';

export function getRealtimeTopic(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(REALTIME_TOPIC_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_REALTIME_TOPIC;
}

export function setRealtimeTopic(topic: string): void {
  if (typeof window !== 'undefined') {
    if (topic && topic.trim()) {
      localStorage.setItem(REALTIME_TOPIC_STORAGE_KEY, topic.trim());
    } else {
      localStorage.removeItem(REALTIME_TOPIC_STORAGE_KEY);
    }
  }
}

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

interface WrappedMessage {
  _senderId: string;
  _msgId: string;
  _timestamp: number;
  action: BroadcastAction;
}

class SyncChannel {
  private bcChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private listeners: ((action: BroadcastAction) => void)[] = [];
  private statusListeners: ((status: RealtimeStatus) => void)[] = [];
  private reconnectTimer: number | null = null;
  private clientId: string;
  private status: RealtimeStatus = 'disconnected';
  private currentTopic: string;
  private processedMsgIds = new Map<string, number>();

  constructor() {
    this.clientId = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    this.currentTopic = getRealtimeTopic();

    // 1. BroadcastChannel for instant same-browser tab sync (0ms)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bcChannel = new BroadcastChannel(LOCAL_CHANNEL_NAME);
        this.bcChannel.onmessage = (event) => {
          if (event.data && typeof event.data === 'object') {
            const wrapped = event.data as WrappedMessage;
            if (wrapped && wrapped.action) {
              if (wrapped._senderId === this.clientId) return;
              this.handleIncomingAction(wrapped.action, wrapped._msgId);
            } else if ((event.data as BroadcastAction).type) {
              this.handleIncomingAction(event.data as BroadcastAction);
            }
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    // 2. High-speed Real-time Cloud Pub/Sub (< 50-100ms) for cross-device sync
    this.connectRealtime();
  }

  private setStatus(newStatus: RealtimeStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((fn) => {
        try { fn(newStatus); } catch {}
      });
    }
  }

  public getStatus(): RealtimeStatus {
    return this.status;
  }

  public onStatusChange(callback: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  public getTopic(): string {
    return this.currentTopic;
  }

  public setTopic(newTopic: string): void {
    const clean = newTopic.trim() || DEFAULT_REALTIME_TOPIC;
    if (clean !== this.currentTopic) {
      this.currentTopic = clean;
      setRealtimeTopic(clean);
      this.reconnect();
    }
  }

  public reconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }
    this.connectRealtime();
  }

  private connectRealtime() {
    if (typeof window === 'undefined') return;

    this.setStatus('connecting');

    // Localhost fallback
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && window.location.port === '3000') {
      try {
        const wsUrl = `ws://${window.location.host}/ws`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => this.setStatus('connected');
        this.ws.onmessage = (event) => {
          try {
            const action = JSON.parse(event.data) as BroadcastAction;
            this.handleIncomingAction(action);
          } catch {}
        };
        this.ws.onclose = () => {
          this.setStatus('disconnected');
          this.scheduleReconnect();
        };
        this.ws.onerror = () => {
          this.setStatus('disconnected');
          this.ws?.close();
        };
        return;
      } catch {}
    }

    // Connect to High-speed Real-time Broker (ntfy.sh WebSocket)
    try {
      const ntfyWsUrl = `wss://ntfy.sh/${encodeURIComponent(this.currentTopic)}/ws`;
      this.ws = new WebSocket(ntfyWsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // ntfy frames: { event: "message", message: "...", topic: "..." }
          if (raw.event === 'message' && raw.message) {
            const wrapped = JSON.parse(raw.message) as WrappedMessage;
            if (wrapped && wrapped.action) {
              if (wrapped._senderId === this.clientId) return; // ignore self
              this.handleIncomingAction(wrapped.action, wrapped._msgId);
            }
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('disconnected');
        this.fallbackToEventSource();
      };
    } catch {
      this.fallbackToEventSource();
    }
  }

  private fallbackToEventSource() {
    if (this.eventSource || typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      this.eventSource = new EventSource(`https://ntfy.sh/${encodeURIComponent(this.currentTopic)}/sse`);

      this.eventSource.onopen = () => {
        this.setStatus('connected');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.event === 'message' && raw.message) {
            const wrapped = JSON.parse(raw.message) as WrappedMessage;
            if (wrapped && wrapped.action) {
              if (wrapped._senderId === this.clientId) return;
              this.handleIncomingAction(wrapped.action, wrapped._msgId);
            }
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        this.setStatus('disconnected');
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.scheduleReconnect();
      };
    } catch {}
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectRealtime();
    }, 2500);
  }

  private handleIncomingAction(action: BroadcastAction, msgId?: string) {
    if (!action || !action.type) return;

    // Deduplicate within 10 seconds
    if (msgId) {
      const now = Date.now();
      if (this.processedMsgIds.has(msgId)) return;
      this.processedMsgIds.set(msgId, now);

      // Clean old IDs
      if (this.processedMsgIds.size > 200) {
        for (const [id, time] of this.processedMsgIds.entries()) {
          if (now - time > 15000) {
            this.processedMsgIds.delete(id);
          }
        }
      }
    }

    this.notifyListeners(action);
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

  // Publish message to all devices across the world instantly (< 50-100ms)
  postMessage(action: BroadcastAction) {
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const wrapped: WrappedMessage = {
      _senderId: this.clientId,
      _msgId: msgId,
      _timestamp: Date.now(),
      action,
    };

    // Mark as processed locally
    this.processedMsgIds.set(msgId, Date.now());

    // 1. Broadcast locally (same machine / other tabs) - 0ms
    if (this.bcChannel) {
      try {
        this.bcChannel.postMessage(wrapped);
      } catch (err) {
        console.error('BroadcastChannel error:', err);
      }
    }

    // 2. Publish to Real-time Cloud Broker (< 50-100ms) for all other devices
    try {
      fetch(`https://ntfy.sh/${encodeURIComponent(this.currentTopic)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(wrapped),
      }).catch((err) => {
        console.warn('Realtime cloud publish warning:', err);
      });
    } catch {}

    // 3. Local WebSocket (if development server)
    if (this.ws && this.ws.readyState === WebSocket.OPEN && window.location.hostname === 'localhost') {
      try {
        this.ws.send(JSON.stringify(action));
      } catch {}
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
