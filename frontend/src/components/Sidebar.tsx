import { Home, Info, LogIn, LogOut, Maximize, Minimize, Moon, SlidersHorizontal, Sun, Swords, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

interface SidebarProps {
  showOptions: boolean;
  onToggleOptions: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ showOptions, onToggleOptions, mobileOpen, onClose }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Closing on route change covers link taps; button actions (options, fullscreen, theme) close explicitly below.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const isOnGamePage = location.pathname === "/partie";

  const handleLogout = () => {
    logout();
    navigate("/");
    onClose();
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <span className="sidebar-brand-icon">♞</span>
            <span className="sidebar-brand-name">ChessIA</span>
          </Link>
          <button type="button" className="sidebar-close-button" onClick={onClose} aria-label="Fermer le menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`sidebar-nav-item ${location.pathname === "/" ? "sidebar-nav-item-active" : ""}`}
            onClick={onClose}
          >
            <Home size={20} />
            <span>Accueil</span>
          </Link>
          <Link
            to="/partie"
            className={`sidebar-nav-item ${isOnGamePage ? "sidebar-nav-item-active" : ""}`}
            onClick={onClose}
          >
            <Swords size={20} />
            <span>Regarder</span>
          </Link>
          <Link
            to="/apropos"
            className={`sidebar-nav-item ${location.pathname === "/apropos" ? "sidebar-nav-item-active" : ""}`}
            onClick={onClose}
          >
            <Info size={20} />
            <span>À propos</span>
          </Link>
          {isOnGamePage && (
            <>
              <button
                type="button"
                className={`sidebar-nav-item ${showOptions ? "sidebar-nav-item-active" : ""}`}
                onClick={() => {
                  onToggleOptions();
                  onClose();
                }}
                aria-pressed={showOptions}
              >
                <SlidersHorizontal size={20} />
                <span>Options</span>
              </button>
              <button
                type="button"
                className="sidebar-nav-item"
                onClick={() => {
                  toggleFullscreen();
                  onClose();
                }}
                aria-pressed={isFullscreen}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                <span>{isFullscreen ? "Quitter le plein écran" : "Plein écran"}</span>
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-auth">
          {user ? (
            // a renvoyer sur le profil (bouton parametre etc)
            <div className="user-profile">
              <p>Connecté en tant que <strong>{user.username}</strong></p>
              {user.elo && <p>Elo Lichess : {user.elo}</p>}
              <button className="btn" onClick={logout}>Se déconnecter</button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn">Connexion</Link>
              <Link to="/signup" className="btn btn-primary">Inscription</Link>
            </div>
          )}
        </div>

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
      </aside>
    </>
  );
}
