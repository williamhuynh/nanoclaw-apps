import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { App } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'apps.db');

export function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      name TEXT PRIMARY KEY,
      repo_path TEXT NOT NULL,
      port INTEGER NOT NULL UNIQUE,
      container_id TEXT,
      status TEXT NOT NULL DEFAULT 'stopped',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS port_allocations (
      port INTEGER PRIMARY KEY,
      app_name TEXT NOT NULL REFERENCES apps(name) ON DELETE CASCADE
    );
  `);
  return db;
}

export function createApp(db: Database.Database, app: Pick<App, 'name' | 'repo_path' | 'port'>): App {
  db.prepare(`INSERT INTO apps (name, repo_path, port) VALUES (?, ?, ?)`).run(app.name, app.repo_path, app.port);
  db.prepare(`INSERT INTO port_allocations (port, app_name) VALUES (?, ?)`).run(app.port, app.name);
  return getApp(db, app.name)!;
}

export function getApp(db: Database.Database, name: string): App | undefined {
  return db.prepare(`SELECT * FROM apps WHERE name = ?`).get(name) as App | undefined;
}

export function listApps(db: Database.Database): App[] {
  return db.prepare(`SELECT * FROM apps ORDER BY created_at`).all() as App[];
}

export function updateAppStatus(db: Database.Database, name: string, status: App['status'], containerId?: string | null, errorMessage?: string | null): void {
  db.prepare(`UPDATE apps SET status = ?, container_id = COALESCE(?, container_id), error_message = ?, updated_at = datetime('now') WHERE name = ?`)
    .run(status, containerId ?? null, errorMessage ?? null, name);
}

export function deleteApp(db: Database.Database, name: string): void {
  db.prepare(`DELETE FROM apps WHERE name = ?`).run(name);
}

export function getNextPort(db: Database.Database, rangeStart = 3001, rangeEnd = 3099): number {
  const used = db.prepare(`SELECT port FROM port_allocations ORDER BY port`).all() as { port: number }[];
  const usedSet = new Set(used.map(r => r.port));
  for (let p = rangeStart; p <= rangeEnd; p++) {
    if (!usedSet.has(p)) return p;
  }
  throw new Error(`No available ports in range ${rangeStart}-${rangeEnd}`);
}
