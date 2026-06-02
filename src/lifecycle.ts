import Docker from 'dockerode';
import type { App } from './types.js';

const docker = new Docker();

export async function buildApp(app: App): Promise<void> {
  const stream = await docker.buildImage(
    { context: app.repo_path, src: ['.'] },
    { t: `nanoclaw-app-${app.name}:latest` }
  );
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve());
  });
}

export async function startApp(app: App): Promise<string> {
  const container = await docker.createContainer({
    Image: `nanoclaw-app-${app.name}:latest`,
    name: `nanoclaw-app-${app.name}`,
    ExposedPorts: { [`${app.port}/tcp`]: {} },
    HostConfig: {
      // Publish on loopback only — apps are reached via MC's reverse proxy, not
      // directly on the LAN (security review F-006).
      PortBindings: { [`${app.port}/tcp`]: [{ HostIp: '127.0.0.1', HostPort: String(app.port) }] },
      RestartPolicy: { Name: 'unless-stopped' },
      // De-privilege the build/run sandbox: drop all caps, forbid privilege
      // escalation, and cap blast radius. ReadonlyRootfs is intentionally NOT
      // set — the scaffold writes a sqlite DB and npm caches; enabling it would
      // need a per-app tmpfs audit. See security review F-006.
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
      Memory: 1024 * 1024 * 1024,
      PidsLimit: 512,
    },
    Env: [`PORT=${app.port}`],
  });
  await container.start();
  return container.id;
}

export async function stopApp(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: 10 });
  } catch (e: any) {
    if (!e.message?.includes('not running')) throw e;
  }
  try {
    await container.remove();
  } catch (e: any) {
    if (!e.message?.includes('No such container')) throw e;
  }
}

export async function getContainerStats(containerId: string): Promise<{ cpu_percent: number; memory_mb: number }> {
  const container = docker.getContainer(containerId);
  const stats = await container.stats({ stream: false });
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || 1;
  return {
    cpu_percent: systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0,
    memory_mb: stats.memory_stats.usage / (1024 * 1024),
  };
}

export async function getContainerLogs(containerId: string, tail = 100): Promise<string> {
  const container = docker.getContainer(containerId);
  const logs = await container.logs({ stdout: true, stderr: true, tail, timestamps: true });
  return logs.toString();
}

export async function listRunningContainers(): Promise<Docker.ContainerInfo[]> {
  return docker.listContainers({ filters: { name: ['nanoclaw-app-'] } });
}
