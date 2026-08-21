export interface Preset {
  id: string;
  label: string;
  boardThemeId: string;
  pieceStyleId: string;
}

export const PRESETS: Preset[] = [
  { id: "vert-contraste", label: "Vert", boardThemeId: "vert", pieceStyleId: "contraste" },
  { id: "bois-classique", label: "Bois", boardThemeId: "marron", pieceStyleId: "classique" },
  { id: "gris-contraste", label: "Contraste", boardThemeId: "gris", pieceStyleId: "contraste" },
  { id: "bleu-vert", label: "Bleu", boardThemeId: "bleu", pieceStyleId: "vert" },
];
