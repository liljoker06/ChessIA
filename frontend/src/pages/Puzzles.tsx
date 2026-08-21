import { Chess, type Square } from "chess.js";
import { Check, RotateCcw, X, DownloadCloud, Dices } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { PUZZLES } from "../data/puzzles";
import { useGameSettings } from "../hooks/useGameSettings";
import { BOARD_THEMES } from "../theme/boardThemes";
import { PIECE_STYLES } from "../theme/pieceStyles";
import "../styles/watch.css";
import "../styles/puzzles.css";

type Feedback = "correct" | "wrong" | null;

interface UnifiedPuzzle {
  id: string | number;
  title: string;
  description: string;
  fen: string;
  moves: string[]; 
}

export function Puzzles() {
  const { settings } = useGameSettings();
  const [index, setIndex] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  
  const [dailyPuzzle, setDailyPuzzle] = useState<UnifiedPuzzle | null>(null);
  const [useDaily, setUseDaily] = useState(false);

  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  
  const [moveIndex, setMoveIndex] = useState(0);
  const [, setVersion] = useState(0);

  const boardTheme = BOARD_THEMES.find((t) => t.id === settings.boardThemeId) ?? BOARD_THEMES[0];
  const pieceStyle = PIECE_STYLES.find((p) => p.id === settings.pieceStyleId) ?? PIECE_STYLES[0];

useEffect(() => {
    fetchDaily();
    // On met un tableau de dépendances vide pour que ça ne s'exécute qu'une seule fois au chargement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDaily = async () => {
    try {
      const res = await fetch("https://lichess.org/api/puzzle/daily");
      const data = await res.json();
      
      const tempChess = new Chess();
      tempChess.loadPgn(data.game.pgn); 

      setDailyPuzzle({
        id: data.puzzle.id,
        title: "Puzzle du jour Lichess",
        description: `Elo: ${data.puzzle.rating} | Joué ${data.puzzle.plays} fois`,
        fen: tempChess.fen(),
        moves: data.puzzle.solution
      });
      setUseDaily(true);
      resetPuzzleState();
    } catch (err) {
      console.error("Erreur de récupération du puzzle Lichess", err);
    }
  };

  // puzzle Inédit
  const fetchRandom = async () => {
    try {
      const token = localStorage.getItem("chess-api-token");
      const API_URL = import.meta.env.VITE_API_URL;
      
      const res = await fetch(`${API_URL}/api/bot/puzzle/next`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      
      if (!res.ok) {
        alert("Erreur : As-tu bien reconnecté ton compte Lichess pour valider l'autorisation puzzle:read ?");
        return;
      }

      const data = await res.json();
      
      const tempChess = new Chess();
      tempChess.loadPgn(data.game.pgn);

      setDailyPuzzle({
        id: data.puzzle.id,
        title: "Puzzle Lichess Inédit",
        description: `Elo: ${data.puzzle.rating} | Joué ${data.puzzle.plays} fois`,
        fen: tempChess.fen(),
        moves: data.puzzle.solution 
      });
      setUseDaily(true);
      resetPuzzleState();
    } catch (err) {
      console.error("Erreur de récupération du puzzle Lichess", err);
    }
  };

  function handleNext() {
    setUseDaily(false);
    setIndex((i) => (i + 1) % PUZZLES.length);
    resetPuzzleState();
  }

  const currentPuzzle: UnifiedPuzzle = useMemo(() => {
    if (useDaily && dailyPuzzle) return dailyPuzzle;
    
    // On convertit tes puzzles locaux au nouveau format
    const p = PUZZLES[index];
    const uciMove = p.solution.from + p.solution.to + (p.solution.promotion || "");
    return {
      id: index,
      title: p.title,
      description: p.description,
      fen: p.fen,
      moves: [uciMove]
    };
  }, [useDaily, dailyPuzzle, index]);

  const game = useMemo(() => new Chess(currentPuzzle.fen), [currentPuzzle]);
  const board = game.board();
  const orientation = useMemo(() => new Chess(currentPuzzle.fen).turn() as "w" | "b", [currentPuzzle]);
  const solved = feedback === "correct";

  function resetPuzzleState() {
    game.load(currentPuzzle.fen);
    setSelected(null);
    setLegalTargets([]);
    setLastMove(null);
    setFeedback(null);
    setMoveIndex(0);
    setVersion((v) => v + 1);
  }

  function handleSquareClick(square: Square) {
    if (solved || feedback === "wrong") return;

    if (selected && legalTargets.includes(square)) {
      const expectedMove = currentPuzzle.moves[moveIndex];
      const expectedFrom = expectedMove.substring(0, 2);
      const expectedTo = expectedMove.substring(2, 4);
      const expectedPromo = expectedMove[4];

      // vérif
      if (selected === expectedFrom && square === expectedTo) {
        // Le coup est bon !
        game.move({ from: selected, to: square, promotion: expectedPromo || "q" });
        setLastMove({ from: selected, to: square });
        setVersion((v) => v + 1);
        setSelected(null);
        setLegalTargets([]);

        // si réponse de l'ennemi
        if (moveIndex + 1 < currentPuzzle.moves.length) {
          const oppMove = currentPuzzle.moves[moveIndex + 1];
          const oppFrom = oppMove.substring(0, 2) as Square;
          const oppTo = oppMove.substring(2, 4) as Square;
          
          // joue automatique
          setTimeout(() => {
            game.move({ from: oppFrom, to: oppTo, promotion: oppMove[4] || "q" });
            setLastMove({ from: oppFrom, to: oppTo });
            setMoveIndex((m) => {
              const nextIndex = m + 2;
              if (nextIndex >= currentPuzzle.moves.length) {
                setFeedback("correct");
                setSolvedCount((c) => c + 1);
              }
              return nextIndex;
            });
            setVersion((v) => v + 1);
          }, 500);

        } else {
          setFeedback("correct");
          setSolvedCount((c) => c + 1);
        }
      } else {
        setFeedback("wrong");
        setTimeout(() => {
          setFeedback(null);
        }, 1500);
        setSelected(null);
        setLegalTargets([]);
      }
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square);
      setLegalTargets(game.moves({ square, verbose: true }).map((m) => m.to as Square));
    } else {
      setSelected(null);
      setLegalTargets([]);
    }
  }

  return (
    <div className="puzzles-page">
      <div className="puzzles-layout">
        <div className="board-column">
          <div className="card puzzles-header">
            <div>
              <span className={`puzzles-progress ${useDaily ? "puzzles-progress-daily" : "puzzles-progress-unique"}`}>
                {useDaily ? "Quotidien Lichess" : `Inédit ${index + 1} / ${PUZZLES.length}`}
              </span>
              <h2>{currentPuzzle.title}</h2>
              <p className="puzzles-description">
                {useDaily
                  ? "Puzzle officiel du jour récupéré depuis Lichess."
                  : "Puzzle inédit choisi sur notre catalogue local via le back."}
              </p>
              <p className="puzzles-description puzzles-description-source">{currentPuzzle.description}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
              <span className="badge">{solvedCount} résolus</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-sm puzzles-mode-button puzzles-mode-button-daily" onClick={fetchDaily}>
                  <DownloadCloud size={14} /> Quotidien
                </button>
                <button className="btn btn-sm puzzles-mode-button puzzles-mode-button-unique" onClick={fetchRandom}>
                  <Dices size={14} /> Inédit
                </button>
              </div>
            </div>
          </div>

          <div
            className={`status-bar ${feedback === "correct" ? "puzzles-status-correct" : ""} ${
              feedback === "wrong" ? "puzzles-status-wrong" : ""
            }`}
          >
            {feedback === "correct" && (
              <>
                <Check size={18} /> Puzzle résolu !
              </>
            )}
            {feedback === "wrong" && (
              <>
                <X size={18} /> Pas le bon coup, réessaie.
              </>
            )}
            {!feedback && (game.turn() === "w" ? "Trait aux Blancs" : "Trait aux Noirs")}
          </div>

          <ChessBoard
            board={board}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            checkSquare={null}
            orientation={orientation}
            onSquareClick={handleSquareClick}
            disabled={solved}
            theme={boardTheme}
            pieceStyle={pieceStyle}
            showCoordinates
            highlightLastMove
          />

          <div className="board-controls">
            <button className="btn btn-ghost btn-sm" onClick={resetPuzzleState} disabled={solved}>
              <RotateCcw size={16} />
              Recommencer ce puzzle
            </button>
            {solved && (
              <button className="btn btn-primary btn-sm" onClick={handleNext}>
                {useDaily ? "Passer aux puzzles locaux" : "Puzzle suivant"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}