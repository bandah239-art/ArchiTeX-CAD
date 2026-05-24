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
      tx.executeSql(`CREATE TABLE IF NOT EXISTS checklist_items (
        project_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        checked INTEGER DEFAULT 0,
        updated_at TEXT,
        PRIMARY KEY (project_id, item_id)
      )`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS checklist_notes (
        project_id TEXT PRIMARY KEY,
        notes TEXT,
        updated_at TEXT
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

export function saveChecklistItem(projectId: string, itemId: string, checked: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT OR REPLACE INTO checklist_items (project_id, item_id, checked, updated_at) VALUES (?,?,?,?)',
        [projectId, itemId, checked ? 1 : 0, new Date().toISOString()],
        () => resolve(),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function saveChecklistNote(projectId: string, notes: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT OR REPLACE INTO checklist_notes (project_id, notes, updated_at) VALUES (?,?,?)',
        [projectId, notes, new Date().toISOString()],
        () => resolve(),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function loadChecklistState(projectId: string): Promise<{ checked: Record<string, boolean>; notes: string }> {
  return new Promise((resolve, reject) => {
    const checked: Record<string, boolean> = {};
    let notes = '';

    db.transaction((tx) => {
      tx.executeSql(
        'SELECT item_id, checked FROM checklist_items WHERE project_id = ?',
        [projectId],
        (_, { rows }) => {
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i) as { item_id: string; checked: number };
            checked[row.item_id] = row.checked === 1;
          }
        }
      );
      tx.executeSql(
        'SELECT notes FROM checklist_notes WHERE project_id = ?',
        [projectId],
        (_, { rows }) => {
          if (rows.length > 0) {
            notes = (rows.item(0) as { notes: string }).notes ?? '';
          }
        },
        (_, err) => { reject(err); return false; }
      );
    }, reject, () => resolve({ checked, notes }));
  });
}
