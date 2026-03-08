import { Router } from 'express';
import type Database from 'better-sqlite3';
import { createApp, getApp, listApps, updateAppStatus, deleteApp, getNextPort } from './db.js';
import { buildApp, startApp, stopApp, getContainerLogs } from './lifecycle.js';
import { scaffold } from './scaffold.js';

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function createRouter(db: Database.Database): Router {
  const router = Router();

  // POST /apps — create a new app
  router.post('/apps', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !NAME_RE.test(name)) {
        res.status(400).json({ error: 'Name must be lowercase alphanumeric with hyphens (e.g. my-app)' });
        return;
      }

      const existing = getApp(db, name);
      if (existing) {
        res.status(409).json({ error: `App "${name}" already exists` });
        return;
      }

      const port = getNextPort(db);
      const repoPath = `/home/nanoclaw/apps/${name}`;

      await scaffold(name, repoPath);
      const app = createApp(db, { name, repo_path: repoPath, port });

      res.status(201).json(app);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /apps — list all apps
  router.get('/apps', (_req, res) => {
    try {
      const apps = listApps(db);
      res.json(apps);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /apps/:name — get app details
  router.get('/apps/:name', (req, res) => {
    try {
      const app = getApp(db, req.params.name);
      if (!app) {
        res.status(404).json({ error: 'App not found' });
        return;
      }
      res.json(app);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /apps/:name/start — build image then start container
  router.post('/apps/:name/start', async (req, res) => {
    try {
      const app = getApp(db, req.params.name);
      if (!app) {
        res.status(404).json({ error: 'App not found' });
        return;
      }

      updateAppStatus(db, app.name, 'building');
      try {
        await buildApp(app);
      } catch (err: any) {
        updateAppStatus(db, app.name, 'error', null, err.message);
        res.status(500).json({ error: `Build failed: ${err.message}` });
        return;
      }

      try {
        const containerId = await startApp(app);
        updateAppStatus(db, app.name, 'running', containerId);
      } catch (err: any) {
        updateAppStatus(db, app.name, 'error', null, err.message);
        res.status(500).json({ error: `Start failed: ${err.message}` });
        return;
      }

      res.json(getApp(db, app.name));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /apps/:name/stop — stop container
  router.post('/apps/:name/stop', async (req, res) => {
    try {
      const app = getApp(db, req.params.name);
      if (!app) {
        res.status(404).json({ error: 'App not found' });
        return;
      }

      if (app.container_id) {
        await stopApp(app.container_id);
      }
      updateAppStatus(db, app.name, 'stopped', null);

      res.json(getApp(db, app.name));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /apps/:name/redeploy — stop, rebuild, start
  router.post('/apps/:name/redeploy', async (req, res) => {
    try {
      const app = getApp(db, req.params.name);
      if (!app) {
        res.status(404).json({ error: 'App not found' });
        return;
      }

      // Stop existing container if running
      if (app.container_id) {
        await stopApp(app.container_id);
        updateAppStatus(db, app.name, 'stopped', null);
      }

      // Rebuild
      updateAppStatus(db, app.name, 'building');
      try {
        await buildApp(app);
      } catch (err: any) {
        updateAppStatus(db, app.name, 'error', null, err.message);
        res.status(500).json({ error: `Build failed: ${err.message}` });
        return;
      }

      // Start new container
      try {
        const containerId = await startApp(app);
        updateAppStatus(db, app.name, 'running', containerId);
      } catch (err: any) {
        updateAppStatus(db, app.name, 'error', null, err.message);
        res.status(500).json({ error: `Start failed: ${err.message}` });
        return;
      }

      res.json(getApp(db, app.name));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /apps/:name — stop container if running, delete from registry
  router.delete('/apps/:name', async (req, res) => {
    try {
      const app = getApp(db, req.params.name);
      if (!app) {
        res.status(404).json({ error: 'App not found' });
        return;
      }

      if (app.container_id) {
        await stopApp(app.container_id);
      }
      deleteApp(db, app.name);

      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /apps/:name/logs — get container logs
  router.get('/apps/:name/logs', async (req, res) => {
    try {
      const app = getApp(db, req.params.name);
      if (!app) {
        res.status(404).json({ error: 'App not found' });
        return;
      }

      if (!app.container_id) {
        res.status(400).json({ error: 'No running container' });
        return;
      }

      const tail = parseInt(req.query.tail as string, 10) || 100;
      const logs = await getContainerLogs(app.container_id, tail);

      res.json({ logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
