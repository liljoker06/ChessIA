import { useGameHistory } from "../hooks/useGameHistory";
import "../styles/history.css";

export function Statistics() {
  const { stats } = useGameHistory();
  const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  return (
    <div className="history-page">
      <h1>Statistiques</h1>
      <p className="history-subtitle">Ton bilan contre les bots, calculé à partir de tes parties jouées ici.</p>

      <div className="history-stats">
        <div className="card history-stat">
          <span className="history-stat-value">{stats.total}</span>
          <span className="history-stat-label">Parties</span>
        </div>
        <div className="card history-stat">
          <span className="history-stat-value">{stats.wins}</span>
          <span className="history-stat-label">Victoires</span>
        </div>
        <div className="card history-stat">
          <span className="history-stat-value">{stats.losses}</span>
          <span className="history-stat-label">Défaites</span>
        </div>
        <div className="card history-stat">
          <span className="history-stat-value">{stats.draws}</span>
          <span className="history-stat-label">Nulles</span>
        </div>
      </div>

      <div className="card">
        <h3>Taux de victoire</h3>
        <p>
          {stats.total === 0
            ? "Joue quelques parties contre un bot pour voir ton taux de victoire."
            : `${winRate}% de tes ${stats.total} parties se terminent par une victoire.`}
        </p>
      </div>
    </div>
  );
}
