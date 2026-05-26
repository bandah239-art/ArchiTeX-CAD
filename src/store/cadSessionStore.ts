import { create } from 'zustand';

export type CadCommand =
  | 'trim'
  | 'extend'
  | 'offset'
  | 'fillet'
  | 'chamfer'
  | 'break'
  | 'stretch'
  | 'align'
  | 'block-create'
  | 'block-insert'
  | 'block-edit'
  | 'param-geom'
  | 'param-dim'
  | 'sweep'
  | 'loft'
  | null;

export interface CadSessionData {
  cutterSeg?: { elementId: string; index: number; a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } };
  elementId?: string;
  vertexIndex?: number;
  alignIds?: string[];
  profileId?: string;
  blockName?: string;
  constraintType?: string;
}

interface CadSessionState {
  command: CadCommand;
  step: number;
  data: CadSessionData;
  hint: string;
  panelOpen: boolean;
  startCommand: (cmd: CadCommand, hint?: string) => void;
  setStep: (step: number, patch?: Partial<CadSessionData>) => void;
  setHint: (hint: string) => void;
  setPanelOpen: (open: boolean) => void;
  clear: () => void;
}

export const useCadSessionStore = create<CadSessionState>((set) => ({
  command: null,
  step: 0,
  data: {},
  hint: '',
  panelOpen: false,

  startCommand: (cmd, hint) =>
    set({
      command: cmd,
      step: 0,
      data: {},
      hint: hint ?? defaultHint(cmd),
      panelOpen: cmd?.startsWith('block') || cmd?.startsWith('param') || false,
    }),

  setStep: (step, patch) =>
    set((s) => ({
      step,
      data: patch ? { ...s.data, ...patch } : s.data,
    })),

  setHint: (hint) => set({ hint }),

  setPanelOpen: (panelOpen) => set({ panelOpen }),

  clear: () =>
    set({
      command: null,
      step: 0,
      data: {},
      hint: '',
      panelOpen: false,
    }),
}));

function defaultHint(cmd: CadCommand): string {
  switch (cmd) {
    case 'trim':
      return 'Pick cutting edge, then object to trim.';
    case 'extend':
      return 'Pick boundary edge, then object end to extend.';
    case 'offset':
      return 'Click a polyline to offset (distance in ribbon).';
    case 'fillet':
      return 'Click a corner vertex to fillet.';
    case 'chamfer':
      return 'Click a corner vertex to chamfer.';
    case 'break':
      return 'Click on a segment to break.';
    case 'stretch':
      return 'Click corner of selection box, then second point for stretch.';
    case 'align':
      return 'Select objects (click), then pick alignment (panel).';
    case 'block-create':
      return 'Select elements, then name block in panel.';
    case 'block-insert':
      return 'Pick insertion point on canvas.';
    case 'block-edit':
      return 'Select block instance to edit.';
    case 'param-geom':
      return 'Pick two sketch entities, then constraint type.';
    case 'param-dim':
      return 'Pick two points or segments for dimension.';
    case 'sweep':
      return 'Pick profile, then path polyline.';
    case 'loft':
      return 'Pick first profile, then second profile.';
    default:
      return '';
  }
}
