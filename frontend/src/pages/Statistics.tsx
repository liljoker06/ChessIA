import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DIFFICULTIES } from "../engine/difficulty";
import { SAMPLE_GAMES, useGameHistory, type HistoryGame } from "../hooks/useGameHistory";
import "../styles/history.css";
import "../styles/statistics.css";

const PERIOD_OPTIONS = [
  { id: "all", label: "Toutes les périodes" },
  { id: "7", label: "7 jours" },
  { id: "30", label: "30 jours" },
  { id: "90", label: "90 jours" },
];

function summarize(games: HistoryGame[]) {
  const total = games.length;
  const wins = games.filter((g) => g.result === "win").length;
  const losses = games.filter((g) => g.result === "loss").length;
  const draws = games.filter((g) => g.result === "draw").length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { total, wins, losses, draws, winRate };
}

export function Statistics() {
  const { user } = useAuth();
  const { games: realGames } = useGameHistory();
  const [periodId, setPeriodId] = useState("all");

  const games = realGames.length > 0 ? realGames : SAMPLE_GAMES;
  const periodMs = periodId === "all" ? null : Number(periodId) * 24 * 3600_000;
  const now = Date.now();
  const filtered = periodMs ? games.filter((g) => now - g.date <= periodMs) : games;

  const overall = summarize(filtered);
  const byDifficulty = DIFFICULTIES.map((d) => ({
    id: d.id,
    label: d.label,
    ...summarize(filtered.filter((g) => g.difficulty === d.label)),
  }));

  return (
    <div className="history-page">
      <div className="card profile-header-card">
        <div className="profile-header-avatar">
          <span>♙</span>
        </div>
        <div className="profile-header-info">
          <div className="profile-header-top">
            <h2>{user?.username ?? "Invité"}</h2>
            <span className="badge profile-header-online">
              <span className="live-dot" />
              En ligne
            </span>
          </div>
          {user?.bio && <p className="profile-header-bio">{user.bio}</p>}
          <p className="profile-header-meta">
            {user
              ? `Inscrit le ${new Date(user.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}`
              : "Pas encore de compte sur cet appareil"}
          </p>
        </div>
        <Link to="/parametres" className="btn btn-secondary">
          Modifier le profil
        </Link>
      </div>

      <h1>Statistiques</h1>
      <p className="history-subtitle">Ton bilan contre les bots, par difficulté et par période.</p>

      <div className="history-toolbar">
        <select className="input history-sort-select" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card history-table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Difficulté</th>
              <th>Parties</th>
              <th>Victoires</th>
              <th>Défaites</th>
              <th>Nulles</th>
              <th>Taux de victoire</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td>{overall.total}</td>
              <td>{overall.wins}</td>
              <td>{overall.losses}</td>
              <td>{overall.draws}</td>
              <td>{overall.total > 0 ? `${overall.winRate}%` : "—"}</td>
            </tr>
            {byDifficulty.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                <td>{row.total}</td>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td>{row.draws}</td>
                <td>{row.total > 0 ? `${row.winRate}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
