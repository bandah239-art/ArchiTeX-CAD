/** Single source of truth for backend API base URL. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export function wsUrl(path: string): string {
  const base = API_BASE.replace(/^http/, 'ws');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
