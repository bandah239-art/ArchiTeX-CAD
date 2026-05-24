import { apiUrl } from './apiConfig';

export const emergingAPI = {
  marketplace: async (countryCode: string) => {
    const res = await fetch(apiUrl(`/emerging/marketplace?country_code=${countryCode}`));
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  satellite: async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/emerging/satellite/analyse'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  blockchain: async (document: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/emerging/blockchain/anchor'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { document } }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  voice: async (transcript: string) => {
    const res = await fetch(apiUrl('/emerging/voice/command'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { transcript } }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  thermal: async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/simulate/thermal'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  seismic: async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/simulate/seismic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
