import { create } from 'zustand';
import type { ItineraryRequest, ItineraryResponse } from "@workspace/api-client-react";

type TripState = {
  step: number;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  request: Partial<ItineraryRequest>;
  updateRequest: (updates: Partial<ItineraryRequest>) => void;

  result: ItineraryResponse | null;
  setResult: (result: ItineraryResponse | null) => void;

  selectedDay: number;
  setSelectedDay: (day: number) => void;

  reset: () => void;
};

const DEFAULT_REQUEST: Partial<ItineraryRequest> = {
  days: 3,
  budgetAmount: 200,
  travelRhythm: 'balanced',
  travelProfile: 'couple',
  transportMode: 'walking',
  interests: [],
};

export const useTripStore = create<TripState>((set) => ({
  step: 1,
  setStep: (step) => set({ step }),
  nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 4) })),
  prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),

  request: { ...DEFAULT_REQUEST },
  updateRequest: (updates) =>
    set((state) => ({ request: { ...state.request, ...updates } })),

  result: null,
  setResult: (result) => set({ result, selectedDay: 1 }),

  selectedDay: 1,
  setSelectedDay: (day) => set({ selectedDay: day }),

  reset: () =>
    set({
      step: 1,
      result: null,
      selectedDay: 1,
      request: { ...DEFAULT_REQUEST },
    }),
}));
