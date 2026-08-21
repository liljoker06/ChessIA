import { BOARD_THEMES } from "../theme/boardThemes";
import type { GameSettings } from "../hooks/useGameSettings";
import "./GameOptionsPanel.css";

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="options-toggle-row">
      <span>{label}</span>
      <button
        className="toggle-switch"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-switch-knob" />
      </button>
    </div>
  );
}

interface GameOptionsPanelProps {
  settings: GameSettings;
  onChange: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
}

export function GameOptionsPanel({ settings, onChange }: GameOptionsPanelProps) {
  return (
    <div className="card options-panel">
      <h3>Options</h3>

      <div className="options-section">
        <span className="options-label">Échiquier</span>
        <div className="board-theme-grid">
          {BOARD_THEMES.map((t) => (
            <button
              key={t.id}
              className={`board-swatch ${settings.boardThemeId === t.id ? "board-swatch-active" : ""}`}
              onClick={() => onChange("boardThemeId", t.id)}
              title={t.label}
              aria-label={t.label}
            >
              <span className="board-swatch-square" style={{ background: t.light }} />
              <span className="board-swatch-square" style={{ background: t.dark }} />
              <span className="board-swatch-square" style={{ background: t.dark }} />
              <span className="board-swatch-square" style={{ background: t.light }} />
            </button>
          ))}
        </div>
      </div>

      <div className="options-section">
        <span className="options-label">Options de jeu</span>
        <ToggleRow
          label="Afficher les coordonnées"
          checked={settings.showCoordinates}
          onChange={(v) => onChange("showCoordinates", v)}
        />
        <ToggleRow
          label="Surbrillance du dernier coup"
          checked={settings.highlightLastMove}
          onChange={(v) => onChange("highlightLastMove", v)}
        />
      </div>
    </div>
  );
}
