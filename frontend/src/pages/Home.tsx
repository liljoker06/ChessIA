import { Link } from "react-router-dom";
import "../styles/home.css";

const STEPS = [
  {
    number: "1",
    title: "Le moteur calcule",
    text: "Stockfish évalue la position et choisit le meilleur coup selon le niveau de difficulté choisi.",
  },
  {
    number: "2",
    title: "Le coup est joué",
    text: "L'échiquier se met à jour automatiquement, sans qu'aucune interaction ne soit nécessaire.",
  },
  {
    number: "3",
    title: "Tu regardes en direct",
    text: "Chaque coup s'ajoute à l'historique en notation algébrique, jusqu'à la fin de la partie.",
  },
];

export function Home() {
  return (
    <div className="home-page">
      <section className="hero">
        <span className="hero-badge">
          <span className="live-dot" />
          En direct
        </span>
        <h1>
          Une IA joue aux échecs. <em>Toute seule.</em>
        </h1>
        <p className="hero-subtitle">
          Un moteur d'échecs joue une partie complète en ligne, coup après coup, sans interruption.
          Tu regardes, en direct.
        </p>
        <Link to="/partie" className="btn btn-primary btn-lg">
          Regarder la partie
        </Link>
        <div className="hero-badges">
          <span className="badge">Moteur Stockfish 18</span>
          <span className="badge">4 niveaux de difficulté</span>
          <span className="badge">Historique en direct</span>
        </div>
      </section>

      <section className="steps">
        <div className="steps-inner">
          <h2 className="section-title">Comment ça marche</h2>
          <div className="steps-grid">
            {STEPS.map((s) => (
              <div className="step-card" key={s.number}>
                <div className="step-number">{s.number}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">
              <span className="footer-brand-icon">♞</span>
              ChessIA
            </div>
            <p className="footer-tagline">Un moteur d'échecs qui joue tout seul, à regarder en direct.</p>
          </div>

          <div className="footer-links">
            <div className="footer-col">
              <h4>Navigation</h4>
              <Link to="/">Accueil</Link>
              <Link to="/partie">Regarder la partie</Link>
              <Link to="/apropos">À propos</Link>
            </div>
            <div className="footer-col">
              <h4>Compte</h4>
              <Link to="/login">Connexion</Link>
              <Link to="/signup">Inscription</Link>
            </div>
          </div>
        </div>
        <p className="footer-bottom">ChessIA — projet personnel.</p>
      </footer>
    </div>
  );
}
