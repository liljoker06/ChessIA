import { Chess } from "chess.js";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";
import { ChessBoard } from "../components/ChessBoard";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { BOARD_THEMES, DEFAULT_BOARD_THEME_ID } from "../theme/boardThemes";
import "../styles/home.css";

const boardTheme = BOARD_THEMES.find((t) => t.id === DEFAULT_BOARD_THEME_ID) ?? BOARD_THEMES[0];
const watchPreviewGame = new Chess();

export function Home() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-media">
          <video className="hero-video" autoPlay muted loop playsInline>
            <source
              src="https://assets-configurator.chess.com/video/configurator/hero_1780586045036.webm"
              type="video/webm"
            />
          </video>
        </div>

        <div className="hero-content">
          <h1>
            Une IA joue aux échecs. <em>Toute seule.</em>
          </h1>
          <p className="hero-subtitle">
            Un moteur d'échecs joue une partie complète en ligne, coup après coup, sans interruption.
            Tu regardes, en direct.
          </p>
        </div>
      </section>

      <section className="feature-section">
        <div className="feature-media">
          <ChessBoard
            board={watchPreviewGame.board()}
            selected={null}
            legalTargets={[]}
            lastMove={null}
            checkSquare={null}
            orientation="w"
            disabled
            theme={boardTheme}
            showCoordinates={false}
            highlightLastMove={false}
          />
        </div>
        <div className="feature-text">
          <h2>Regarde l'IA jouer</h2>
          <p>Une partie complète, jouée en direct par le moteur, coup après coup, sans que tu n'aies rien à faire.</p>
          <Link to="/partie" className="btn btn-secondary">
            Regarder la partie
          </Link>
        </div>
      </section>

      <section className="feature-section feature-section-reverse">
        <div className="feature-media">
          <img
            src="https://assets-configurator.chess.com/image/configurator/bots_1765899028922.webp"
            alt="Personnalités de bots"
          />
        </div>
        <div className="feature-text">
          <h2>Affronte un bot</h2>
          <p>Choisis ton camp et un niveau de difficulté, puis joue toi-même contre le moteur Stockfish.</p>
          <Link to="/bots" className="btn btn-secondary">
            Défier un bot
          </Link>
        </div>
      </section>

      <section className="feature-section">
        <div className="feature-media">
          <img
            src="https://assets-configurator.chess.com/image/configurator/puzzles_1765899040725.webp"
            alt="Illustration d'un puzzle d'échecs"
          />
        </div>
        <div className="feature-text">
          <h2>Muscle-toi avec des puzzles</h2>
          <p>Une petite série de tactiques (mats, pièces à gagner) à résoudre directement sur l'échiquier.</p>
          <Link to="/puzzles" className="btn btn-secondary">
            Résoudre un puzzle
          </Link>
        </div>
      </section>

      <section className="feature-section feature-section-reverse">
        <div className="feature-media">
          <div className="phone-mockup">
            <div className="phone-mockup-notch" />
            <div className="phone-mockup-screen">
              <span className="phone-mockup-brand">
                <span className="sidebar-brand-icon">♞</span>
                ChessIA
              </span>
              <div className="phone-mockup-board" />
            </div>
          </div>
        </div>
        <div className="feature-text">
          <h2>Installe ChessIA</h2>
          {installed ? (
            <p>ChessIA est installé sur cet appareil.</p>
          ) : (
            <>
              <p>Ajoute ChessIA à ton écran d'accueil pour l'ouvrir comme une application, en un geste.</p>
              {canInstall ? (
                <button className="btn btn-secondary" onClick={promptInstall}>
                  <Download size={18} />
                  Installer
                </button>
              ) : (
                <p className="feature-text-hint">
                  Depuis le menu de ton navigateur, choisis « Ajouter à l'écran d'accueil » ou « Installer
                  l'application ».
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="cta-banner">
        <h2>Prêt à commencer ?</h2>
        <Link to="/partie" className="btn btn-primary btn-lg">
          Regarder la partie
        </Link>
      </section>

      <footer className="footer">
        <nav className="footer-links-row">
          <Link to="/">Accueil</Link>
          <span className="footer-dot">•</span>
          <Link to="/partie">Regarder la partie</Link>
          <span className="footer-dot">•</span>
          <Link to="/bots">Bots</Link>
          <span className="footer-dot">•</span>
          <Link to="/puzzles">Puzzles</Link>
          <span className="footer-dot">•</span>
          <Link to="/apropos">À propos</Link>
          <span className="footer-dot">•</span>
          <Link to="/login">Connexion</Link>
          <span className="footer-dot">•</span>
          <Link to="/signup">Inscription</Link>
          <span className="footer-dot">•</span>
          <span>ChessIA, projet personnel © 2026</span>
        </nav>
      </footer>
    </div>
  );
}
