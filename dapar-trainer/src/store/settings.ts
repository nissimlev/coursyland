import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DifficultySetting } from '../questions/types';

export type Theme = 'light' | 'dark';

export interface PracticePrefs {
  difficulty: DifficultySetting;
  count: number;
  timePerQuestionSec: number | null;
}

interface SettingsState {
  /** null = לפי הגדרת המערכת */
  theme: Theme | null;
  practice: PracticePrefs;
  setTheme: (t: Theme) => void;
  setPractice: (p: PracticePrefs) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: null,
      practice: { difficulty: 'mixed', count: 10, timePerQuestionSec: null },
      setTheme: (theme) => set({ theme }),
      setPractice: (practice) => set({ practice }),
    }),
    {
      // השם הזה נקרא גם ב-index.html כדי למנוע הבהוב של ערכת הצבעים
      name: 'dapar:settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}
