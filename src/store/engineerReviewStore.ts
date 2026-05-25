import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StepReviewStatus } from '../types/calculations';

export interface StepReviewRecord {
  status: StepReviewStatus;
  overrideValue: string;
  overrideReason: string;
  flagNote: string;
  reviewedAt: string;
}

interface EngineerReviewState {
  engineerName: string;
  registrationNumber: string;
  /** Key: `${module}:${stepNumber}` */
  stepReviews: Record<string, StepReviewRecord>;
  setEngineerName: (name: string) => void;
  setRegistrationNumber: (reg: string) => void;
  setStepReview: (key: string, record: StepReviewRecord) => void;
  clearStepReviews: () => void;
}

export const useEngineerReviewStore = create<EngineerReviewState>()(
  persist(
    (set) => ({
      engineerName: '',
      registrationNumber: '',
      stepReviews: {},
      setEngineerName: (engineerName) => set({ engineerName }),
      setRegistrationNumber: (registrationNumber) => set({ registrationNumber }),
      setStepReview: (key, record) =>
        set((s) => ({ stepReviews: { ...s.stepReviews, [key]: record } })),
      clearStepReviews: () => set({ stepReviews: {} }),
    }),
    { name: 'infra-engineer-review' }
  )
);
