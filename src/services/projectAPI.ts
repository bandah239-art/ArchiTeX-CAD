import { apiUrl } from './apiConfig';

export const projectAPI = {
  /** Save or update a project record on the backend. */
  async save(project: Record<string, unknown>): Promise<{ saved: boolean; project_id: string }> {
    const res = await fetch(apiUrl('/project/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) throw new Error(`Project save failed: ${res.status}`);
    return res.json();
  },

  /** Store a rolling auto-save snapshot (backend keeps last 5 per project). */
  async autoSave(projectId: string, snapshot: Record<string, unknown>): Promise<{ auto_saved: boolean }> {
    const res = await fetch(apiUrl(`/project/${encodeURIComponent(projectId)}/autosave`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (!res.ok) throw new Error(`Auto-save failed: ${res.status}`);
    return res.json();
  },

  /** Retrieve available auto-save snapshots for recovery. */
  async getAutoSaves(projectId: string): Promise<{ snapshots: Array<{ id: number; saved_at: string; snapshot: unknown }> }> {
    const res = await fetch(apiUrl(`/project/${encodeURIComponent(projectId)}/autosaves`));
    if (!res.ok) throw new Error(`Failed to fetch auto-saves: ${res.status}`);
    return res.json();
  },

  /** Fetch full project summary including calculations history. */
  async getSummary(projectId: string): Promise<Record<string, unknown>> {
    const res = await fetch(apiUrl(`/project/${encodeURIComponent(projectId)}/summary`));
    if (!res.ok) throw new Error(`Project summary failed: ${res.status}`);
    return res.json();
  },

  /** List all projects. */
  async list(): Promise<{ projects: unknown[] }> {
    const res = await fetch(apiUrl('/projects'));
    if (!res.ok) throw new Error(`Projects list failed: ${res.status}`);
    return res.json();
  },

  /** Log IFC element → calculator prefill for audit trail. */
  async logIfcCalcLink(payload: {
    project_id: string;
    ifc_global_id: string;
    ifc_express_id: string;
    ifc_type: string;
    calc_module: string;
    confidence: string;
    inputs: Record<string, unknown>;
  }): Promise<{ logged: boolean }> {
    const res = await fetch(apiUrl('/project/ifc-calc-link'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`IFC calc link log failed: ${res.status}`);
    return res.json();
  },
};
