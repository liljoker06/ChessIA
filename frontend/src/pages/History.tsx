import { Chess } from "chess.js";
import { Bot, Clock, Download, Heart, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { SAMPLE_GAMES, useGameHistory, type HistoryGame } from "../hooks/useGameHistory";
import { BOARD_THEMES, DEFAULT_BOARD_THEME_ID } from "../theme/boardThemes";
import "../styles/history.css";

import { useAuth } from "../context/AuthContext"; 

type SortOrder = "desc" | "asc";
type FilterTab = "all" | "favorites";

const STATUS_LABEL: Record<string, string> = {
  checkmate: "Échec et mat",
  stalemate: "Pat",
  repetition: "Nulle par répétition",
  "insufficient-material": "Matériel insuffisant",
  "fifty-moves": "Règle des 50 coups",
  draw: "Nulle",
};

const OPENING_BY_FIRST_MOVE: Record<string, string> = {
  e4: "Partie ouverte (1.e4)",
  d4: "Partie fermée (1.d4)",
  c4: "Anglaise (1.c4)",
  Nf3: "Réti (1.Cf3)",
  g3: "Fianchetto (1.g3)",
};

function openingLabel(firstMoveSan: string): string {
  if (!firstMoveSan) return "Partie";
  return OPENING_BY_FIRST_MOVE[firstMoveSan] ?? `Ouverture (1.${firstMoveSan})`;
}

function perspectiveResult(result: HistoryGame["result"], forPlayer: boolean): HistoryGame["result"] {
  if (result === "draw") return "draw";
  if (forPlayer) return result;
  return result === "win" ? "loss" : "win";
}

function resultScore(result: HistoryGame["result"]): string {
  if (result === "draw") return "½";
  return result === "win" ? "1" : "0";
}

const DIFFICULTY_BASE_RATING: Record<string, number> = {
  Facile: 800,
  Moyen: 1200,
  Difficile: 1600,
  Maître: 2000,
};

const TIME_CONTROLS = ["3 min", "5 min", "10 min", "15 min", "30 min"];

function hashSeed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

// Illustrative only — decorative rating/accuracy numbers to match a familiar layout.
// There's no real rating or move-analysis system behind these.
function illustrativeStats(game: any) {
  // Si on a  les vraies stats Lichess, on les retourne 
  if (game.realStats) {
    return {
      playerRating: game.realStats.playerRating,
      aiRating: game.realStats.aiRating,
      playerDelta: game.realStats.playerDelta,
      aiDelta: game.realStats.aiDelta,
      playerAccuracy: "-", 
      aiAccuracy: "-",
      timeControl: game.realStats.timeControl,
    };
  }

  // Comportement par défaut (fake) pour les parties locales sans Lichess
  const seed = hashSeed(game.id);
  const aiRating = DIFFICULTY_BASE_RATING[game.difficulty] ?? 1200;
  const playerRating = 900 + (seed % 500);
  const delta = 6 + (seed % 15);
  const playerDelta = game.result === "win" ? delta : game.result === "loss" ? -delta : Math.round(delta / 4);
  const aiDelta = -playerDelta;
  const accSeed = hashSeed(`${game.id}-acc`);
  
  return {
    playerRating,
    aiRating,
    playerDelta,
    aiDelta,
    playerAccuracy: 60 + (accSeed % 35),
    aiAccuracy: 60 + ((accSeed >> 3) % 35),
    timeControl: TIME_CONTROLS[hashSeed(`${game.id}-time`) % TIME_CONTROLS.length],
  };
}

function downloadPgn(game: HistoryGame) {
  const blob = new Blob([game.pgn], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `partie-${new Date(game.date).toISOString().slice(0, 10)}-${game.id.slice(0, 8)}.pgn`;
  link.click();
  URL.revokeObjectURL(url);
}

const boardTheme = BOARD_THEMES.find((t) => t.id === DEFAULT_BOARD_THEME_ID) ?? BOARD_THEMES[0];

interface HistoryRowProps {
  game: HistoryGame;
  onToggleFavorite: () => void;
}

function HistoryRow({ game, onToggleFavorite }: HistoryRowProps) {
  const finalPosition = new Chess(game.finalFen);
  const stats = illustrativeStats(game);

  return (
    <div className="card history-row">
      <div className="history-row-thumb">
        <ChessBoard
          board={finalPosition.board()}
          selected={null}
          legalTargets={[]}
          lastMove={null}
          checkSquare={null}
          orientation={game.playerColor}
          disabled
          theme={boardTheme}
          showCoordinates={false}
          highlightLastMove={false}
        />
      </div>

      <div className="history-row-mode">
        <span className="history-row-mode-item">
          <Clock size={18} />
          <span>{stats.timeControl}</span>
        </span>
        <span className="history-row-mode-item">
          <Bot size={18} />
          <span>{game.difficulty}</span>
        </span>
      </div>

      <div className="history-row-main">
        <div className="history-row-player">
          <span>
            Toi{" "}
            <span className="history-row-rating">
              ({stats.playerRating}{" "}
              <span className={stats.playerDelta >= 0 ? "history-rating-up" : "history-rating-down"}>
                {stats.playerDelta >= 0 ? `+${stats.playerDelta}` : stats.playerDelta}
              </span>
              )
            </span>
          </span>
          <span className={`history-score history-score-${perspectiveResult(game.result, true)}`}>
            {resultScore(perspectiveResult(game.result, true))}
          </span>
        </div>
        <div className="history-row-player">
          <span>
            IA{" "}
            <span className="history-row-rating">
              ({stats.aiRating}{" "}
              <span className={stats.aiDelta >= 0 ? "history-rating-up" : "history-rating-down"}>
                {stats.aiDelta >= 0 ? `+${stats.aiDelta}` : stats.aiDelta}
              </span>
              )
            </span>
          </span>
          <span className={`history-score history-score-${perspectiveResult(game.result, false)}`}>
            {resultScore(perspectiveResult(game.result, false))}
          </span>
        </div>
        <p className="history-row-meta">
          {openingLabel(game.firstMoveSan)} · {game.moveCount} coups · {STATUS_LABEL[game.status] ?? game.status}
        </p>
      </div>

      <div className="history-row-accuracy">
        <span>{stats.playerAccuracy}</span>
        <span>{stats.aiAccuracy}</span>
      </div>

      <div className="history-row-side">
        <span className="history-row-date">
          {new Date(game.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </span>
        <div className="history-row-actions">
          <button
            className={`history-action-button ${game.favorite ? "history-action-button-active" : ""}`}
            onClick={onToggleFavorite}
            title={game.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={game.favorite}
          >
            <Heart size={16} fill={game.favorite ? "currentColor" : "none"} />
          </button>
          <button className="history-action-button" onClick={() => downloadPgn(game)} title="Télécharger le PGN">
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function History() {
  const { games: localGames, toggleFavorite } = useGameHistory();
  const { user } = useAuth(); 
  
  const [lichessGames, setLichessGames] = useState<HistoryGame[]>([]);
  const [loadingLichess, setLoadingLichess] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filter, setFilter] = useState<FilterTab>("all");
const lichessFetchStarted = useRef(false);

useEffect(() => {
  if (!user?.isLichess) return;

  // Empêche le double appel en développement avec React StrictMode
  if (lichessFetchStarted.current) {
    console.log("appel déjà fait, skip");
    return;
  }

  lichessFetchStarted.current = true;

  const fetchLichessHistory = async () => {
    setLoadingLichess(true);

    try {
      const token = localStorage.getItem("chess-api-token");
      const API_URL = import.meta.env.VITE_API_URL;

      const res = await fetch(
        `${API_URL}/api/bot/games?limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();

        const adapted = data.games.map((g: any) =>
          adaptLichessGame(g, user.username)
        );

        setLichessGames(adapted);
      } else {
        console.error(
          "Erreur API historique:",
          res.status,
          await res.text()
        );
      }
    } catch (err) {
      console.error("Erreur chargement parties Lichess:", err);
    } finally {
      setLoadingLichess(false);
    }
  };

  fetchLichessHistory();
}, [user?.isLichess, user?.username]);

  // si user connecté, prendre vrais données sinon les locales/samples
  const games = user?.isLichess 
    ? lichessGames 
    : (localGames.length > 0 ? localGames : SAMPLE_GAMES);

  const favoriteCount = games.filter((g) => g.favorite).length;
  const filtered = filter === "favorites" ? games.filter((g) => g.favorite) : games;
  const sorted = [...filtered].sort((a, b) => (sortOrder === "desc" ? b.date - a.date : a.date - b.date));

  return (
    <div className="history-page">
      <h1>Historique des parties</h1>
      <p className="history-subtitle">
        {user?.isLichess 
          ? `Parties officielles de ${user.username} sur Lichess.` 
          : "Tes parties jouées contre les bots, enregistrées sur cet appareil."}
      </p>

      <div className="history-toolbar">
        <div className="history-toolbar-tabs">
          <button
            className={`history-toolbar-tab ${filter === "all" ? "history-toolbar-tab-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tout ({games.length})
          </button>
          <button
            className={`history-toolbar-tab ${filter === "favorites" ? "history-toolbar-tab-active" : ""}`}
            onClick={() => setFilter("favorites")}
          >
            <Heart size={14} /> Favoris ({favoriteCount})
          </button>
        </div>
        <select
          className="input history-sort-select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
        >
          <option value="desc">Date décroissante</option>
          <option value="asc">Date croissante</option>
        </select>
      </div>

      {loadingLichess ? (
        <div className="card">
          <p>Chargement des parties depuis Lichess...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card">
          <p>Aucune partie trouvée.</p>
        </div>
      ) : (
        <div className="history-row-list">
          {sorted.map((g) => (
            <HistoryRow
              key={g.id}
              game={g}
              onToggleFavorite={() => toggleFavorite(g.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// transforme une partie Lichess brute en format HistoryGame
function adaptLichessGame(lichessGame: any, currentUsername: string): HistoryGame & { realStats?: any } {
  // couleur (pseudo noir ou blanc)
  const blackName = lichessGame.players?.black?.user?.name || "";
  const isWhite = blackName.toLowerCase() !== currentUsername.toLowerCase();
  const playerColor = isWhite ? "white" : "black";
  
  // vrai gagnant
  let result: "win" | "loss" | "draw" = "draw";
  if (lichessGame.winner) {
    result = lichessGame.winner === playerColor ? "win" : "loss";
  }

  //  calcul le nombre de coups (Lichess donne une chaîne "e4 e5 Nf3...")
  const moveArray = lichessGame.moves ? lichessGame.moves.trim().split(" ") : [];
  const moveCount = Math.ceil(moveArray.length / 2);

  // extract des vrais joueurs et Elos
  const myStats = lichessGame.players[playerColor];
  const oppStats = lichessGame.players[playerColor === "white" ? "black" : "white"];
  const aiName = oppStats?.user?.name || (oppStats?.aiLevel ? `IA Lichess (Lvl ${oppStats.aiLevel})` : "Adversaire");
  
  //Format temps
  const timeControl = lichessGame.clock ? `${lichessGame.clock.initial / 60} min` : "Classique";

  return {
    id: lichessGame.id,
    date: lichessGame.createdAt || Date.now(),
    finalFen: lichessGame.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    playerColor: playerColor,
    result: result,
    moveCount: moveCount,
    firstMoveSan: moveArray[0] || "", 
    status: lichessGame.status || "completed",
    difficulty: aiName,
    pgn: lichessGame.pgn || "",
    favorite: false,
    
    realStats: {
      playerRating: myStats?.rating || "?",
      aiRating: oppStats?.rating || "?",
      playerDelta: myStats?.ratingDiff || 0,
      aiDelta: oppStats?.ratingDiff || 0,
      timeControl: timeControl,
    }
  } as any;
}