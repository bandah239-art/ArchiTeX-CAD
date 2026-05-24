import { getPendingSync } from '../offline/sqlite';

const DESKTOP_IP = '192.168.1.100';
const API_BASE = `http://${DESKTOP_IP}:8000`;

export interface SyncResult {
  synced: number;
  queued: number;
  last_sync: string;
}

export async function syncToDesktop(): Promise<SyncResult> {
  const pending = await getPendingSync();
  let synced = 0;
  for (const item of pending) {
    try {
      const response = await fetch(`${API_BASE}/sync/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: item.payload,
      });
      if (response.ok) synced += 1;
    } catch {
      // remain queued for retry
    }
  }
  return {
    synced,
    queued: pending.length - synced,
    last_sync: new Date().toISOString(),
  };
}
