export interface BoardTheme {
  id: string;
  label: string;
  light: string;
  dark: string;
  highlight: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "bleu", label: "Bleu", light: "#ece3cf", dark: "#175781", highlight: "#ffd30e" },
  { id: "vert", label: "Vert", light: "#ecdfc0", dark: "#6f9c46", highlight: "#f3d582" },
  { id: "noir", label: "Noir", light: "#d9d9d9", dark: "#3a3a3a", highlight: "#ffd30e" },
  { id: "marron", label: "Marron", light: "#d8c7a1", dark: "#7c5a3a", highlight: "#f0b93f" },
  { id: "violet", label: "Violet", light: "#e6def0", dark: "#5b4a7c", highlight: "#ffd30e" },
  { id: "gris", label: "Gris", light: "#e4e6e8", dark: "#5a6672", highlight: "#ffd30e" },
];

export const DEFAULT_BOARD_THEME_ID = "bleu";
