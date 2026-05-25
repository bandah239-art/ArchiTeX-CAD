/**
 * Offline sync engine — better-sqlite3 embedded DB for Electron main process.
 */
import { createRequire } from 'module';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

const require = createRequire(import.meta.url);

let db = null;
let dbError = null;

function loadDatabase() {
  if (db || dbError) return db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(getDbPath());
    initSchema(db);
  } catch (err) {
    dbError = err;
    console.warn('[Offline] SQLite unavailable:', err.message);
  }
  return db;
}

function getDbPath() {
  return path.join(app.getPath('userData'), 'infra-offline.db');
}

function getDb() {
  const database = loadDatabase();
  if (!database) {
    throw new Error(dbError?.message ?? 'Offline database unavailable');
  }
  return database;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      server_revision INTEGER,
      conflict_data TEXT
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      data TEXT,
      updated_at INTEGER,
      server_revision INTEGER
    );
    CREATE TABLE IF NOT EXISTS calculations (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      type TEXT,
      inputs TEXT,
      results TEXT,
      created_at INTEGER,
      synced INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
  `);
}

export function recordChange(table, recordId, operation, data) {
  const database = getDb();
  const id = crypto.randomUUID();
  database
    .prepare(
      `INSERT OR REPLACE INTO sync_queue (id, table_name, record_id, operation, data, timestamp, synced)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    )
    .run(id, table, recordId, operation, JSON.stringify(data), Date.now());
  return { id };
}

export function getUnsyncedCount() {
  try {
    const row = getDb().prepare('SELECT COUNT(*) as n FROM sync_queue WHERE synced = 0').get();
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export function getSyncStatus() {
  try {
    const database = getDb();
    const pending = database.prepare('SELECT COUNT(*) as n FROM sync_queue WHERE synced = 0').get();
    const projects = database.prepare('SELECT COUNT(*) as n FROM projects').get();
    const calcs = database.prepare('SELECT COUNT(*) as n FROM calculations').get();
    return {
      db_path: getDbPath(),
      pending: pending?.n ?? 0,
      projects: projects?.n ?? 0,
      calculations: calcs?.n ?? 0,
    };
  } catch (err) {
    return {
      db_path: getDbPath(),
      pending: 0,
      projects: 0,
      calculations: 0,
      error: err instanceof Error ? err.message : 'Offline DB unavailable',
    };
  }
}

export async function syncToServer(apiBase, authToken = '') {
  const database = getDb();
  const pending = database
    .prepare('SELECT * FROM sync_queue WHERE synced = 0 ORDER BY timestamp ASC')
    .all();

  if (!pending.length) {
    return { pushed: 0, pulled: 0, conflicts: 0 };
  }

  const response = await fetch(`${apiBase}/sync/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ operations: pending }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const result = await response.json();
  const markSynced = database.prepare(
    'UPDATE sync_queue SET synced = 1, server_revision = ? WHERE id = ?'
  );

  for (const item of result.accepted ?? []) {
    markSynced.run(item.revision ?? Date.now(), item.id);
  }

  let pulled = 0;
  for (const change of result.server_changes ?? []) {
    try {
      const payload = change.payload ?? change;
      if (payload?.name || payload?.project_id) {
        saveProjectLocal(payload.id ?? change.id, payload, false);
        pulled++;
      }
    } catch {
      /* skip bad rows */
    }
  }

  return {
    pushed: result.pushed ?? (result.accepted?.length ?? 0),
    pulled,
    conflicts: result.conflicts?.length ?? 0,
  };
}

export function saveProjectLocal(id, data, record = true) {
  const database = getDb();
  database
    .prepare(
      `INSERT OR REPLACE INTO projects (id, name, data, updated_at) VALUES (?, ?, ?, ?)`
    )
    .run(id ?? crypto.randomUUID(), data.name ?? 'Project', JSON.stringify(data), Date.now());
  if (record) {
    recordChange('projects', id, 'UPDATE', data);
  }
}

export function loadProjectsLocal() {
  const rows = getDb().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ...JSON.parse(r.data || '{}'),
    updated_at: r.updated_at,
  }));
}

export function saveCalculationLocal(id, projectId, type, inputs, results) {
  const database = getDb();
  database
    .prepare(
      `INSERT OR REPLACE INTO calculations (id, project_id, type, inputs, results, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    )
    .run(id, projectId, type, JSON.stringify(inputs), JSON.stringify(results), Date.now());
  recordChange('calculations', id, 'INSERT', { project_id: projectId, type, inputs, results });
}

export function loadCalculationsLocal(projectId) {
  const rows = getDb()
    .prepare('SELECT * FROM calculations WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId);
  return rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    type: r.type,
    inputs: JSON.parse(r.inputs || '{}'),
    results: JSON.parse(r.results || '{}'),
    created_at: r.created_at,
  }));
}

export function closeOfflineDb() {
  if (db) {
    db.close();
    db = null;
  }
}
