import {
  BarChart3,
  Bot,
  ChevronDown,
  History,
  Home,
  Info,
  LogIn,
  LogOut,
  Maximize,
  Minimize,
  Moon,
  Puzzle,
  SlidersHorizontal,
  Sun,
  Swords,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
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
  const isOnHistoryGroup = location.pathname === "/historique" || location.pathname === "/statistiques";
  const [historyExpanded, setHistoryExpanded] = useState(isOnHistoryGroup);

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
            to="/bots"
            className={`sidebar-nav-item ${location.pathname === "/bots" ? "sidebar-nav-item-active" : ""}`}
            onClick={onClose}
          >
            <Bot size={20} />
            <span>Bots</span>
          </Link>
          <Link
            to="/puzzles"
            className={`sidebar-nav-item ${location.pathname === "/puzzles" ? "sidebar-nav-item-active" : ""}`}
            onClick={onClose}
          >
            <Puzzle size={20} />
            <span>Puzzles</span>
          </Link>
          <button
            type="button"
            className={`sidebar-nav-item sidebar-nav-item-group ${isOnHistoryGroup ? "sidebar-nav-item-active" : ""}`}
            onClick={() => setHistoryExpanded((v) => !v)}
            aria-expanded={historyExpanded}
          >
            <History size={20} />
            <span>Historique</span>
            <ChevronDown size={16} className={`sidebar-chevron ${historyExpanded ? "sidebar-chevron-open" : ""}`} />
          </button>
          {historyExpanded && (
            <div className="sidebar-subgroup">
              <Link
                to="/statistiques"
                className={`sidebar-nav-item ${location.pathname === "/statistiques" ? "sidebar-nav-item-active" : ""}`}
                onClick={onClose}
              >
                <BarChart3 size={18} />
                <span>Statistiques</span>
              </Link>
              <Link
                to="/historique"
                className={`sidebar-nav-item ${location.pathname === "/historique" ? "sidebar-nav-item-active" : ""}`}
                onClick={onClose}
              >
                <History size={18} />
                <span>Historique des parties</span>
              </Link>
            </div>
          )}
          <Link
            to="/parametres"
            className={`sidebar-nav-item ${location.pathname === "/parametres" ? "sidebar-nav-item-active" : ""}`}
            onClick={onClose}
          >
            <SlidersHorizontal size={20} />
            <span>Paramètres</span>
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
