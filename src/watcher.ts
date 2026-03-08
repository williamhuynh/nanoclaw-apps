import { watch } from 'chokidar';
import type { Database } from 'better-sqlite3';
import * as db from './db.js';
import * as lifecycle from './lifecycle.js';

const DEBOUNCE_MS = 5000;
const timers = new Map<string, NodeJS.Timeout>();

export function startWatcher(database: Database, appsDir: string): void {
  const watcher = watch(appsDir, {
    ignoreInitial: true,
    ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    depth: 3,
  });

  watcher.on('all', (_event, filePath) => {
    const relative = filePath.replace(appsDir + '/', '');
    const appName = relative.split('/')[0];
    if (!appName) return;

    const app = db.getApp(database, appName);
    if (!app || app.status !== 'running') return;

    const existing = timers.get(appName);
    if (existing) clearTimeout(existing);

    timers.set(appName, setTimeout(async () => {
      timers.delete(appName);
      console.log(`[watcher] Changes detected in ${appName}, redeploying...`);
      try {
        db.updateAppStatus(database, appName, 'building');
        if (app.container_id) await lifecycle.stopApp(app.container_id);
        await lifecycle.buildApp(app);
        const containerId = await lifecycle.startApp(app);
        db.updateAppStatus(database, appName, 'running', containerId);
        console.log(`[watcher] ${appName} redeployed successfully`);
      } catch (e: any) {
        console.error(`[watcher] ${appName} redeploy failed:`, e.message);
        db.updateAppStatus(database, appName, 'error', null, e.message);
      }
    }, DEBOUNCE_MS));
  });

  console.log(`[watcher] Watching ${appsDir} for changes`);
}
