export interface AccentOption {
  id: string;
  label: string;
  accent: string;
  accentStrong: string;
  accentRgb: string;
  accentText: string;
}

export const ACCENTS: AccentOption[] = [
  { id: "vert", label: "Vert", accent: "#81b64c", accentStrong: "#6aab3a", accentRgb: "129, 182, 76", accentText: "#ffffff" },
  { id: "bleu", label: "Bleu", accent: "#3b82f6", accentStrong: "#2563eb", accentRgb: "59, 130, 246", accentText: "#ffffff" },
  { id: "violet", label: "Violet", accent: "#8b5cf6", accentStrong: "#7c3aed", accentRgb: "139, 92, 246", accentText: "#ffffff" },
  { id: "orange", label: "Orange", accent: "#f97316", accentStrong: "#ea580c", accentRgb: "249, 115, 22", accentText: "#ffffff" },
];

export const DEFAULT_ACCENT_ID = "vert";
