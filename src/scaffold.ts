import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export async function scaffold(name: string, repoPath: string, _template = 'default'): Promise<void> {
  if (fs.existsSync(repoPath)) throw new Error(`Directory already exists: ${repoPath}`);
  fs.mkdirSync(repoPath, { recursive: true });

  // package.json
  fs.writeFileSync(path.join(repoPath, 'package.json'), JSON.stringify({
    name: `nanoclaw-app-${name}`,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'concurrently "tsx watch src/server/index.ts" "vite"',
      build: 'vite build && tsc -p tsconfig.server.json',
      start: 'node dist/server/index.js',
    },
    dependencies: {
      express: '^5.0.0',
      'better-sqlite3': '^11.0.0',
    },
    devDependencies: {
      '@types/express': '^5.0.0',
      '@types/better-sqlite3': '^7.6.0',
      '@types/node': '^22.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      '@vitejs/plugin-react': '^4.0.0',
      autoprefixer: '^10.0.0',
      concurrently: '^9.0.0',
      postcss: '^8.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'react-router-dom': '^7.0.0',
      tailwindcss: '^4.0.0',
      tsx: '^4.0.0',
      typescript: '^5.0.0',
      vite: '^6.0.0',
    },
  }, null, 2));

  // Dockerfile
  fs.writeFileSync(path.join(repoPath, 'Dockerfile'), `FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
`);

  // tsconfig for server
  fs.writeFileSync(path.join(repoPath, 'tsconfig.server.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      outDir: 'dist/server', rootDir: 'src/server', strict: true, esModuleInterop: true,
    },
    include: ['src/server'],
  }, null, 2));

  // tsconfig for frontend
  fs.writeFileSync(path.join(repoPath, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
      jsx: 'react-jsx', strict: true, esModuleInterop: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    },
    include: ['src/frontend'],
  }, null, 2));

  // Server entry
  fs.mkdirSync(path.join(repoPath, 'src/server'), { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'src/server/index.ts'), `import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());

// API routes
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist/frontend')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../../dist/frontend/index.html')));
}

app.listen(PORT, () => console.log(\`App listening on :\${PORT}\`));
`);

  // Frontend entry
  fs.mkdirSync(path.join(repoPath, 'src/frontend'), { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'src/frontend/main.tsx'), `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

createRoot(document.getElementById('root')!).render(<App />);
`);

  fs.writeFileSync(path.join(repoPath, 'src/frontend/App.tsx'), `export default function App() {
  return <div className="p-8"><h1 className="text-2xl font-bold">NanoClaw App: ${name}</h1></div>;
}
`);

  // Vite config
  fs.writeFileSync(path.join(repoPath, 'vite.config.ts'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  build: { outDir: '../../dist/frontend' },
  server: { proxy: { '/api': 'http://localhost:' + (process.env.PORT || 3001) } },
});
`);

  // index.html
  fs.writeFileSync(path.join(repoPath, 'src/frontend/index.html'), `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${name}</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
`);

  // CLAUDE.md
  fs.writeFileSync(path.join(repoPath, 'CLAUDE.md'), `# ${name}\n\nNanoClaw app. Built with React + Express + TypeScript.\n`);

  // .gitignore
  fs.writeFileSync(path.join(repoPath, '.gitignore'), 'node_modules/\ndist/\n*.db\n');

  // Init git repo
  execSync('git init && git add -A && git commit -m "init: scaffold from nanoclaw-apps"', { cwd: repoPath });
}
