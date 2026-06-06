import { useEffect, useState } from 'react';
import { useGovernmentStore } from '../../store/governmentStore';

export function ProjectRegisterForm({ onCancel }: { onCancel: () => void }) {
  const { registerOptions, loadRegisterOptions, createProject, isLoading } = useGovernmentStore();
  const [form, setForm] = useState({
    project_name: '',
    project_code: '',
    project_type: 'building',
    province: 'Lusaka',
    district: '',
    gps_lat: '',
    gps_lon: '',
    contract_value_usd: '',
    contract_value_local: '',
    currency: 'ZMW',
    funding_source: 'GRZ',
    contractor_name: '',
    consultant_name: '',
    contract_date: '',
    commencement_date: '',
    original_completion: '',
    status: 'construction',
  });

  useEffect(() => {
    loadRegisterOptions();
  }, [loadRegisterOptions]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.project_name.trim()) return;
    createProject({
      ...form,
      gps_lat: form.gps_lat ? parseFloat(form.gps_lat) : null,
      gps_lon: form.gps_lon ? parseFloat(form.gps_lon) : null,
      contract_value_usd: parseFloat(form.contract_value_usd) || 0,
      contract_value_local: parseFloat(form.contract_value_local) || 0,
    });
  };

  const provinces = registerOptions?.provinces ?? ['Lusaka', 'Central', 'Southern'];
  const sectors = registerOptions?.sectors ?? ['building', 'road', 'water_wash'];
  const funding = registerOptions?.funding_sources ?? ['GRZ', 'World_Bank', 'AfDB'];
  const statuses = registerOptions?.statuses ?? ['construction', 'design', 'tender'];

  return (
    <div className="space-y-3 text-xs">
      <h3 className="text-sm font-bold text-white uppercase">New Project Register Entry</h3>

      <Field label="Project name" value={form.project_name} onChange={(v) => set('project_name', v)} />
      <Field label="Reference / code" value={form.project_code} onChange={(v) => set('project_code', v)} />

      <div className="grid grid-cols-2 gap-2">
        <Select label="Sector" value={form.project_type} options={sectors} onChange={(v) => set('project_type', v)} />
        <Select label="Status" value={form.status} options={statuses} onChange={(v) => set('status', v)} />
        <Select label="Province" value={form.province} options={provinces} onChange={(v) => set('province', v)} />
        <Select label="Funding" value={form.funding_source} options={funding} onChange={(v) => set('funding_source', v)} />
      </div>

      <Field label="District" value={form.district} onChange={(v) => set('district', v)} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="GPS Lat" value={form.gps_lat} onChange={(v) => set('gps_lat', v)} />
        <Field label="GPS Lon" value={form.gps_lon} onChange={(v) => set('gps_lon', v)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Contract USD" value={form.contract_value_usd} onChange={(v) => set('contract_value_usd', v)} />
        <Field label="Contract ZMW" value={form.contract_value_local} onChange={(v) => set('contract_value_local', v)} />
      </div>

      <Field label="Contractor" value={form.contractor_name} onChange={(v) => set('contractor_name', v)} />
      <Field label="Consultant" value={form.consultant_name} onChange={(v) => set('consultant_name', v)} />

      <div className="grid grid-cols-3 gap-2">
        <Field label="Contract date" value={form.contract_date} onChange={(v) => set('contract_date', v)} placeholder="YYYY-MM-DD" />
        <Field label="Start" value={form.commencement_date} onChange={(v) => set('commencement_date', v)} placeholder="YYYY-MM-DD" />
        <Field label="Completion" value={form.original_completion} onChange={(v) => set('original_completion', v)} placeholder="YYYY-MM-DD" />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-infra-accent/50 rounded text-gray-400">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isLoading}
          className="flex-1 py-2 bg-infra-highlight text-white font-bold rounded disabled:opacity-50"
        >
          {isLoading ? 'Saving…' : 'Register Project'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 uppercase mb-0.5">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 uppercase mb-0.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white">
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
  );
}
