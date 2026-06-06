import { apiUrl } from './apiConfig';

export const emergingAPI = {
  capabilities: async () => {
    const res = await fetch(apiUrl('/emerging/capabilities'));
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  marketplace: async (countryCode: string, opts: { type?: string; q?: string; maxPrice?: number } = {}) => {
    const params = new URLSearchParams({ country_code: countryCode });
    if (opts.type) params.set('type', opts.type);
    if (opts.q) params.set('q', opts.q);
    if (opts.maxPrice != null) params.set('max_price', String(opts.maxPrice));
    const res = await fetch(apiUrl(`/emerging/marketplace?${params.toString()}`));
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  createListing: async (listing: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/emerging/marketplace'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listing),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  deleteListing: async (id: string) => {
    const res = await fetch(apiUrl(`/emerging/marketplace/${id}`), { method: 'DELETE' });
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
    const res = await fetch(apiUrl('/ai/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: transcript }),
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
  disaster: async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/emerging/disaster/plan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  drone: async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/emerging/drone/process'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  cvSafety: async (payload: Record<string, unknown>, imageBase64 = '') => {
    const res = await fetch(apiUrl('/emerging/cv/safety'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  arScene: async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/emerging/ar/scene'), {
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
