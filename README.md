# NanoClaw Apps

Companion service that extends [NanoClaw](https://github.com/williamhuynh/nanoclaw) into an app platform. Manages the lifecycle of full-stack web applications running on the same host — build, deploy, monitor, and auto-redeploy on code changes.

## What It Does

- **Scaffolds new apps** with React + Express + Vite boilerplate
- **Builds and runs** each app in its own Docker container
- **Auto-redeploys** when it detects git commits in an app's directory
- **Manages ports** from a pool (3001-3099, auto-allocated)
- **Exposes a REST API** for app lifecycle operations

## Tech Stack

Express, Node.js 22, TypeScript, better-sqlite3, Dockerode, chokidar

## API

Runs on `http://localhost:4000/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/apps` | Create a new app |
| `GET` | `/apps` | List all apps |
| `GET` | `/apps/:name` | Get app details (status, port, container ID) |
| `POST` | `/apps/:name/start` | Build image and start container |
| `POST` | `/apps/:name/stop` | Stop and remove container |
| `POST` | `/apps/:name/redeploy` | Stop, rebuild, and restart |
| `DELETE` | `/apps/:name` | Stop container and delete from registry |
| `GET` | `/apps/:name/logs` | Get container logs |
| `GET` | `/health` | Health check |

## App Lifecycle

1. **Create** — `POST /api/apps` scaffolds files in `~/apps/{name}/`
2. **Start** — Builds Docker image, creates container with allocated port
3. **Auto-redeploy** — File watcher detects git commits, debounces 5s, rebuilds
4. **Stop/Delete** — Stops container, cleans up registry entry

## Setup

```bash
npm install
npm run build
npm start        # Runs on port 4000
```

Development:
```bash
npm run dev      # tsx watch with hot reload
```

## Service Management

```bash
systemctl --user start nanoclaw-apps
systemctl --user stop nanoclaw-apps
systemctl --user restart nanoclaw-apps
```

Logs: `logs/nanoclaw-apps.log` and `logs/nanoclaw-apps.error.log`

## Directory Structure

```
nanoclaw-apps/
├── src/
│   ├── index.ts       # Entry point, Express server on port 4000
│   ├── api.ts         # Route handlers
│   ├── db.ts          # SQLite registry (apps table, port allocations)
│   ├── types.ts       # TypeScript interfaces
│   ├── lifecycle.ts   # Docker build/start/stop operations
│   ├── scaffold.ts    # App boilerplate code generation
│   └── watcher.ts     # File change detection, auto-redeploy
├── data/              # SQLite database
├── logs/              # Service logs
└── dist/              # Compiled output
```

## Related

- [NanoClaw](https://github.com/williamhuynh/nanoclaw) — the agent engine
- [Mission Control](https://github.com/williamhuynh/mission-control) — the first app built on this platform
