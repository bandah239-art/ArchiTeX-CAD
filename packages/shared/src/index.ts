/** Shared constants and types for desktop + mobile. */

export const APP_NAME = 'ARCHITEX-CAD';

export const AFRICAN_COUNTRIES = [
  { code: 'ZM', label: 'Zambia', flag: '🇿🇲' },
  { code: 'KE', label: 'Kenya', flag: '🇰🇪' },
  { code: 'NG', label: 'Nigeria', flag: '🇳🇬' },
  { code: 'GH', label: 'Ghana', flag: '🇬🇭' },
  { code: 'TZ', label: 'Tanzania', flag: '🇹🇿' },
  { code: 'ZW', label: 'Zimbabwe', flag: '🇿🇼' },
  { code: 'BW', label: 'Botswana', flag: '🇧🇼' },
  { code: 'MZ', label: 'Mozambique', flag: '🇲🇿' },
  { code: 'SN', label: 'Senegal', flag: '🇸🇳' },
  { code: 'CI', label: "Côte d'Ivoire", flag: '🇨🇮' },
] as const;

export type CountryCode = (typeof AFRICAN_COUNTRIES)[number]['code'];

export const CHECKLIST_PHASES = ['foundation', 'structural', 'roofing', 'finishes', 'handover'] as const;

export const FOUNDATION_CHECKLIST = [
  { id: '1', label: 'Excavation dimensions match drawings', phase: 'excavation' },
  { id: '2', label: 'Formation level at correct depth', phase: 'excavation' },
  { id: '3', label: 'Ground conditions as anticipated', phase: 'excavation' },
  { id: '4', label: 'Trial pit / DCP test conducted', phase: 'excavation' },
  { id: '5', label: 'No standing water in excavation', phase: 'excavation' },
  { id: '6', label: 'Blinding concrete placed and cured', phase: 'concrete' },
  { id: '7', label: 'Reinforcement diameter correct (H16)', phase: 'concrete' },
  { id: '8', label: 'Bar spacing per drawing (200 c/c)', phase: 'concrete' },
  { id: '9', label: 'Cover blocks in place (50mm)', phase: 'concrete' },
  { id: '10', label: 'Concrete grade confirmed (C25)', phase: 'concrete' },
  { id: '11', label: 'Slump test conducted', phase: 'concrete' },
  { id: '12', label: 'Concrete cube samples taken', phase: 'concrete' },
] as const;

export interface ScheduleActivity {
  id: string;
  name: string;
  startWeek: number;
  durationWeeks: number;
  quantity: number;
  unit: string;
  costUsd: number;
  ifcType?: string;
}

export interface ScheduleResult {
  duration_weeks: number;
  total_cost_usd: number;
  activities: Array<{
    id: string;
    name: string;
    start_week: number;
    duration_weeks: number;
    cost_usd: number;
  }>;
}
