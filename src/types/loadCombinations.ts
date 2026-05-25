export type LoadCombinationCode = 'EC0' | 'ACI318' | 'BS8110';

export interface LoadCombinationRow {
  combo_number: number | string;
  expression: string;
  substitution: string;
  result: number;
  unit: string;
  reference: string;
  governing: boolean;
}

export interface LoadCombinationsResult {
  code: LoadCombinationCode;
  inputs: { gk: number; qk: number; wk: number; ek: number };
  unit: string;
  uls_combinations: LoadCombinationRow[];
  sls_combinations: LoadCombinationRow[];
  governing_uls: { value: number; expression: string; combo: number | string };
  governing_sls: { value: number; expression: string; combo: number | string } | null;
  feed_to_calculators: {
    beam_design_load: number;
    slab_design_load: number;
    column_design_load: number;
    foundation_design_load: number;
  };
  timestamp: string;
}
