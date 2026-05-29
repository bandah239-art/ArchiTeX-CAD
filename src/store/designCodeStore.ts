import { create } from 'zustand';

export type DesignCode = 'BS_8110' | 'EC2' | 'ACI_318';

export const CODE_LABELS: Record<DesignCode, string> = {
  BS_8110: 'BS 8110 (Zambia/UK)',
  EC2: 'EN 1992 (Europe)',
  ACI_318: 'ACI 318 (USA)',
};

interface DesignCodeState {
  activeCode: DesignCode;
  setCode: (code: DesignCode) => void;
}

export const useDesignCodeStore = create<DesignCodeState>((set) => ({
  activeCode: (localStorage.getItem('infra_active_design_code') as DesignCode) || 'BS_8110',
  setCode: (code) => {
    localStorage.setItem('infra_active_design_code', code);
    set({ activeCode: code });
  },
}));
