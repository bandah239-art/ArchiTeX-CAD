import { apiUrl } from './apiConfig';

const CACHE_PREFIX = 'infra_calc_cache_';

export async function cachedFetch<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = CACHE_PREFIX + endpoint + JSON.stringify(payload);
  try {
    return await fetcher();
  } catch (err) {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached) as T;
    throw err;
  }
}

export function saveProjectMetaLocal(meta: Record<string, unknown>) {
  try {
    localStorage.setItem('infra_last_project', JSON.stringify(meta));
  } catch {
    /* quota / private mode */
  }
  // Fire-and-forget; never blocks UI or throws on dashboard load.
  void fetch(apiUrl('/cache/project'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  }).catch(() => undefined);
}

export function loadProjectMetaLocal(): Record<string, unknown> | null {
  const raw = localStorage.getItem('infra_last_project');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
