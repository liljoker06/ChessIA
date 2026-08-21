export interface PieceStyle {
  id: string;
  label: string;
  whiteFill: string;
  whiteStroke: string;
  blackFill: string;
  blackStroke: string;
}

export const PIECE_STYLES: PieceStyle[] = [
  { id: "contraste", label: "Contraste", whiteFill: "#ffffff", whiteStroke: "#000000", blackFill: "#000000", blackStroke: "#000000" },
  { id: "classique", label: "Classique", whiteFill: "#fbf3d8", whiteStroke: "#312e2b", blackFill: "#1a1714", blackStroke: "#1a1714" },
  { id: "vert", label: "Vert", whiteFill: "#eafbe0", whiteStroke: "#2f5c22", blackFill: "#1e3a14", blackStroke: "#1e3a14" },
];

export const DEFAULT_PIECE_STYLE_ID = "contraste";
