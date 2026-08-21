import { LogIn, LogOut, Moon, Sun } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="nav">
      <Link to="/" className="nav-logo">
        <span className="piece">♞</span>
        <span>Chess</span>
      </Link>

      <nav className="nav-links">
        <Link to="/lobby" className={`nav-link ${isActive("/lobby") ? "active" : ""}`}>
          Salon
        </Link>
        <Link to="/play/computer" className={`nav-link ${isActive("/play/computer") ? "active" : ""}`}>
          Contre l'ordinateur
        </Link>
      </nav>

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

        {user ? (
          <>
            <span className="badge">{user.username}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <LogOut size={16} />
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-secondary btn-sm">
              <LogIn size={16} />
              Connexion
            </Link>
            <Link to="/signup" className="btn btn-primary btn-sm">
              Inscription
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
