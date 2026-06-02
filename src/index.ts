import express from 'express';
import fs from 'fs';
import { initDatabase } from './db.js';
import { createRouter } from './api.js';
import { startWatcher } from './watcher.js';

const app = express();
const PORT = 4000;

fs.mkdirSync('/home/nanoclaw/nanoclaw-apps/data', { recursive: true });
fs.mkdirSync('/home/nanoclaw/apps', { recursive: true });

const db = initDatabase();

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', createRouter(db));

// Bind to loopback only. This control plane drives `docker build`/`run` on the
// host (root-equivalent via the docker group) and has no auth of its own, so it
// must never be reachable from agent containers (which hit the host as
// host.docker.internal/172.17.x) or the LAN. Its only legitimate caller is
// Mission Control's proxy, which targets http://localhost:4000 (loopback). See
// security review F-004/F-024 (~/security-qa-remediation-plan-2026-05-31.md).
app.listen(PORT, '127.0.0.1', () => {
  console.log(`nanoclaw-apps listening on 127.0.0.1:${PORT}`);
  startWatcher(db, '/home/nanoclaw/apps');
});
