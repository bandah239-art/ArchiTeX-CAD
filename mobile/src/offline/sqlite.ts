import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('infraafrica.db');

export function initDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY, item_type TEXT, project_id TEXT,
        payload TEXT, priority INTEGER DEFAULT 5,
        synced INTEGER DEFAULT 0, created_at TEXT
      )`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS site_reports (
        id TEXT PRIMARY KEY, project_id TEXT, payload TEXT, created_at TEXT
      )`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY, project_id TEXT, uri TEXT, latitude REAL,
        longitude REAL, timestamp TEXT, uploaded INTEGER DEFAULT 0
      )`);
    }, reject, () => resolve());
  });
}

export function saveToQueue(item: { id: string; type: string; project_id: string; payload: unknown; priority?: number }) {
  return new Promise<void>((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT OR REPLACE INTO sync_queue (id, item_type, project_id, payload, priority, created_at) VALUES (?,?,?,?,?,?)',
        [item.id, item.type, item.project_id, JSON.stringify(item.payload), item.priority ?? 5, new Date().toISOString()],
        () => resolve(),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function getPendingSync(): Promise<{ id: string; item_type: string; payload: string }[]> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM sync_queue WHERE synced = 0 ORDER BY priority ASC, created_at ASC',
        [],
        (_, { rows }) => resolve(rows._array as { id: string; item_type: string; payload: string }[]),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}
