export interface DifficultyPreset {
  id: string;
  label: string;
  skillLevel: number;
  movetimeMs: number;
}

export const DIFFICULTIES: DifficultyPreset[] = [
  { id: "facile", label: "Facile", skillLevel: 2, movetimeMs: 300 },
  { id: "moyen", label: "Moyen", skillLevel: 8, movetimeMs: 600 },
  { id: "difficile", label: "Difficile", skillLevel: 14, movetimeMs: 1200 },
  { id: "maitre", label: "Maître", skillLevel: 20, movetimeMs: 2500 },
];
