import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="nav">
      <div className="nav-logo">
        <span className="piece">♞</span>
        <span>ChessIA</span>
      </div>

      <div className="nav-actions">
        <button
          className="theme-switch"
          onClick={toggleTheme}
          role="switch"
          aria-checked={theme === "dark"}
          aria-label={theme === "light" ? "Activer le thème sombre" : "Activer le thème clair"}
          title={theme === "light" ? "Thème sombre" : "Thème clair"}
        >
          <Sun size={13} className="theme-switch-icon theme-switch-icon-sun" />
          <Moon size={13} className="theme-switch-icon theme-switch-icon-moon" />
          <span className="theme-switch-knob" />
        </button>
      </div>
    </header>
  );
}
