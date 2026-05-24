import { API_BASE } from './apiConfig';

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const optimizerAPI = {
  structural: (inputs: Record<string, unknown>) => post('/optimize/structural', inputs),
  solar: (inputs: Record<string, unknown>) => post('/optimize/solar', inputs),
};

export const seismicAPI = {
  analyze: (inputs: Record<string, unknown>) => post('/simulate/seismic', inputs),
};
