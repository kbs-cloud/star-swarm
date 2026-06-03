import { isPackagedMode } from '../../utils/env';

export function getServerUrl(): string {
  return localStorage.getItem('starswarm_server_url') || 'http://localhost:3001';
}

export function isOnlineMode(): boolean {
  if (!isPackagedMode()) {
    return true; // Web mode is always online
  }
  return localStorage.getItem('starswarm_play_online') === 'true';
}

export function getApiUrl(path: string): string {
  if (isPackagedMode() && isOnlineMode()) {
    const base = getServerUrl().replace(/\/$/, '');
    return `${base}${path}`;
  }
  return path;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(path);
  
  // Ensure credentials: 'include' is set so cookies are sent across origins (crucial for Electron -> Server)
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };
  
  return fetch(url, fetchOptions);
}
