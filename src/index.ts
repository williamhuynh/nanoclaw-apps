import express from 'express';
import fs from 'fs';
import { initDatabase } from './db.js';
import { createRouter } from './api.js';

const app = express();
const PORT = 4000;

fs.mkdirSync('/home/nanoclaw/nanoclaw-apps/data', { recursive: true });
fs.mkdirSync('/home/nanoclaw/apps', { recursive: true });

const db = initDatabase();

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', createRouter(db));

app.listen(PORT, () => {
  console.log(`nanoclaw-apps listening on :${PORT}`);
});
