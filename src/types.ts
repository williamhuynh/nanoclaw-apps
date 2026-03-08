export interface App {
  name: string;
  repo_path: string;
  port: number;
  container_id: string | null;
  status: 'stopped' | 'building' | 'running' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
