import { useEffect, useState } from 'react';
import { bimGeometryAPI, type CadEngineStatus as CadStatus } from '../../services/bimGeometryAPI';

type Props = {
  /** Inline chip row vs stacked panel */
  variant?: 'inline' | 'panel';
  className?: string;
};

export function CadEngineStatusIndicator({ variant = 'inline', className = '' }: Props) {
  const [status, setStatus] = useState<CadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bimGeometryAPI
      .cadStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'CAD status unavailable');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        className={`text-[10px] text-amber-300/90 ${className}`}
        title={error}
      >
        CAD engine: offline (start Python server)
      </div>
    );
  }

  if (!status) {
    return (
      <div className={`text-[10px] text-gray-500 ${className}`}>CAD engine: checking…</div>
    );
  }

  const dxfOk = status.ezdxf;
  const dwgOk = status.ezdxf && status.oda_file_converter;

  if (variant === 'panel') {
    return (
      <div
        className={`rounded-lg border border-infra-accent/25 bg-black/30 p-3 space-y-2 ${className}`}
      >
        <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">
          CAD import engine
        </p>
        <StatusRow label="ezdxf (DXF parser)" ok={status.ezdxf} />
        <StatusRow label="ODA File Converter (DWG)" ok={status.oda_file_converter} />
        <p className="text-[10px] leading-relaxed text-gray-500 pt-1 border-t border-infra-accent/15">
          {dwgOk
            ? 'DWG and DXF files can be opened with full geometry import.'
            : dxfOk
              ? 'DXF works. For DWG, install ODA File Converter or save as DXF from AutoCAD.'
              : 'Install Python dependency: pip install ezdxf'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-[10px] font-mono ${className}`}
      title={status.dwg_hint}
    >
      <span className="text-gray-500">CAD:</span>
      <Chip label="ezdxf" ok={status.ezdxf} />
      <Chip label="ODA" ok={status.oda_file_converter} />
      <span
        className={`px-1.5 py-0.5 rounded border ${
          dwgOk
            ? 'border-emerald-600/40 text-emerald-400 bg-emerald-950/30'
            : dxfOk
              ? 'border-amber-600/40 text-amber-300 bg-amber-950/20'
              : 'border-red-600/40 text-red-300 bg-red-950/20'
        }`}
      >
        DWG {dwgOk ? 'ready' : dxfOk ? 'needs ODA' : 'unavailable'}
      </span>
    </div>
  );
}

function Chip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded border ${
        ok
          ? 'border-emerald-600/50 text-emerald-400 bg-emerald-950/40'
          : 'border-gray-600/50 text-gray-500 bg-gray-900/40'
      }`}
    >
      {label}: {ok ? 'yes' : 'no'}
    </span>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={ok ? 'text-emerald-400 font-medium' : 'text-gray-500'}>
        {ok ? 'yes' : 'no'}
      </span>
    </div>
  );
}
