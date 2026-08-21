import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_ACCENT_ID } from "../theme/accents";
import { DEFAULT_BOARD_THEME_ID } from "../theme/boardThemes";
import { DEFAULT_PIECE_STYLE_ID } from "../theme/pieceStyles";

export interface GameSettings {
  boardThemeId: string;
  pieceStyleId: string;
  accentId: string;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  defaultDifficultyId: string;
  reduceMotion: boolean;
}

const DEFAULTS: GameSettings = {
  boardThemeId: DEFAULT_BOARD_THEME_ID,
  pieceStyleId: DEFAULT_PIECE_STYLE_ID,
  accentId: DEFAULT_ACCENT_ID,
  showCoordinates: true,
  highlightLastMove: true,
  defaultDifficultyId: "moyen",
  reduceMotion: false,
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

interface GameSettingsContextValue {
  settings: GameSettings;
  update: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
}

const GameSettingsContext = createContext<GameSettingsContextValue | null>(null);

export function GameSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GameSettings>(readSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  function update<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return <GameSettingsContext.Provider value={{ settings, update }}>{children}</GameSettingsContext.Provider>;
}

export function useGameSettings() {
  const ctx = useContext(GameSettingsContext);
  if (!ctx) throw new Error("useGameSettings must be used within GameSettingsProvider");
  return ctx;
}
