import { useEffect, useState } from "react";
import { DEFAULT_BOARD_THEME_ID } from "../theme/boardThemes";
import { DEFAULT_PIECE_STYLE_ID } from "../theme/pieceStyles";

export interface GameSettings {
  boardThemeId: string;
  pieceStyleId: string;
  showCoordinates: boolean;
  highlightLastMove: boolean;
}

const DEFAULTS: GameSettings = {
  boardThemeId: DEFAULT_BOARD_THEME_ID,
  pieceStyleId: DEFAULT_PIECE_STYLE_ID,
  showCoordinates: true,
  highlightLastMove: true,
};

const STORAGE_KEY = "chess-game-settings";

function readSettings(): GameSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { ...DEFAULTS, ...stored };
  } catch {
    return DEFAULTS;
  }
}

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(readSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  function update<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return { settings, update };
}
