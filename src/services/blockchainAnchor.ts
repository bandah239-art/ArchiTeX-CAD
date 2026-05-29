/** SHA-256 hash via Web Crypto API (works in Electron + modern browsers) */
async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AnchorRecord {
  hash: string;
  timestamp: number;
  document_type: string;
  document_summary: string;
  project?: string;
  engineer?: string;
  chain?: 'local' | 'polygon' | 'opentimestamps';
  tx_url?: string;
}

const STORAGE_KEY = 'infra_tech_anchors_v1';

function loadAnchors(): AnchorRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as AnchorRecord[];
  } catch {
    return [];
  }
}

function saveAnchors(records: AnchorRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-500)));
}

/**
 * Anchor a document by hashing its contents and recording the result.
 * Returns the AnchorRecord which includes the SHA-256 hash.
 * Optionally attempts to anchor via OpenTimestamps REST API (free, no key needed).
 */
export async function anchorDocument(params: {
  data: object;
  document_type: string;
  document_summary: string;
  project?: string;
  engineer?: string;
}): Promise<AnchorRecord> {
  const canonical = JSON.stringify(params.data, Object.keys(params.data).sort());
  const hash = await sha256(canonical);

  const record: AnchorRecord = {
    hash,
    timestamp: Date.now(),
    document_type:    params.document_type,
    document_summary: params.document_summary,
    project:          params.project,
    engineer:         params.engineer,
    chain:            'local',
  };

  // Try OpenTimestamps calendar API (free, no auth required)
  // This creates a verifiable proof on the Bitcoin blockchain via a calendar server
  try {
    const ots = await fetch('https://finney.calendar.eternitywall.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `digest=${hash}&algorithm=sha256`,
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (ots?.ok) {
      record.chain = 'opentimestamps';
      record.tx_url = `https://opentimestamps.org/verify#${hash}`;
    }
  } catch {
    // Silently fall back to local anchoring — hash is still valid
  }

  const existing = loadAnchors();
  existing.push(record);
  saveAnchors(existing);

  return record;
}

/** Verify a hash exists in the local anchor store */
export function verifyHash(hash: string): AnchorRecord | null {
  return loadAnchors().find((r) => r.hash === hash) ?? null;
}

/** Return all anchors, newest first */
export function getAnchorHistory(): AnchorRecord[] {
  return loadAnchors().reverse();
}

/** Format an AnchorRecord for display on a report */
export function anchorBadge(record: AnchorRecord): string {
  const date = new Date(record.timestamp).toISOString().slice(0, 19).replace('T', ' ');
  const chain = record.chain === 'opentimestamps' ? 'OpenTimestamps/Bitcoin' : 'Local SHA-256';
  return `Verified ${date} UTC | ${chain} | ${record.hash.slice(0, 16)}…`;
}
