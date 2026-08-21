import { Cpu, Eye, ShieldCheck } from "lucide-react";
import "../styles/about.css";

const POINTS = [
  {
    icon: Cpu,
    title: "Un vrai moteur d'échecs",
    text: "Stockfish 18 tourne directement dans ton navigateur (WebAssembly) et calcule chaque coup, sans serveur distant.",
  },
  {
    icon: Eye,
    title: "Spectateur, pas joueur",
    text: "Il n'y a rien à jouer ici : l'IA joue les deux camps, tu regardes la partie se dérouler en direct, coup par coup.",
  },
  {
    icon: ShieldCheck,
    title: "Aucun serveur",
    text: "Ce projet n'a pas de backend. Les comptes (connexion/inscription) sont stockés uniquement dans ton navigateur, pas sur un serveur.",
  },
];

export function About() {
  return (
    <div className="about-page">
      <section className="about-hero">
        <h1>À propos de ChessIA</h1>
        <p className="about-subtitle">
          Un petit projet personnel pour regarder une IA jouer aux échecs toute seule, sans rien
          avoir à faire soi-même.
        </p>
      </section>

      <section className="about-points">
        {POINTS.map((p) => (
          <div className="card about-point" key={p.title}>
            <div className="about-point-icon">
              <p.icon size={22} />
            </div>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </div>
        ))}
      </section>

      <section className="about-stack">
        <h2 className="section-title">Sous le capot</h2>
        <div className="about-stack-list">
          <span className="badge">React</span>
          <span className="badge">TypeScript</span>
          <span className="badge">chess.js</span>
          <span className="badge">Stockfish 18 (WASM)</span>
          <span className="badge">Vite</span>
        </div>
      </section>
    </div>
  );
}
