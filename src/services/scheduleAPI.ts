import { apiUrl } from './apiConfig';

export const scheduleAPI = {
  async buildFromBim(payload: {
    project_name: string;
    duration_weeks: number;
    elements: Record<string, unknown>[];
  }) {
    const res = await fetch(apiUrl('/schedule/build-from-bim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
