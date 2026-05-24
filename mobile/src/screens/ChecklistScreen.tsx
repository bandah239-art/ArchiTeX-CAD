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
];

export const CHECKLIST_PHASES = ['foundation', 'structural', 'roofing', 'finishes', 'handover'] as const;
