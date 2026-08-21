import { Chess, type Square } from "chess.js";
import { Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { PUZZLES } from "../data/puzzles";
import { useGameSettings } from "../hooks/useGameSettings";
import { BOARD_THEMES } from "../theme/boardThemes";
import { PIECE_STYLES } from "../theme/pieceStyles";
import "../styles/watch.css";
import "../styles/puzzles.css";

type Feedback = "correct" | "wrong" | null;

export function Puzzles() {
  const { settings } = useGameSettings();
  const [index, setIndex] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const boardTheme = BOARD_THEMES.find((t) => t.id === settings.boardThemeId) ?? BOARD_THEMES[0];
  const pieceStyle = PIECE_STYLES.find((p) => p.id === settings.pieceStyleId) ?? PIECE_STYLES[0];
  const puzzle = PUZZLES[index];

  const game = useMemo(() => new Chess(puzzle.fen), [puzzle]);
  const board = game.board();
  const orientation = game.turn();
  const solved = feedback === "correct";

  function resetSelection() {
    setSelected(null);
    setLegalTargets([]);
  }

  function handleSquareClick(square: Square) {
    if (solved) return;

    if (selected && legalTargets.includes(square)) {
      const isMatch =
        selected === puzzle.solution.from &&
        square === puzzle.solution.to &&
        game.moves({ square: selected, verbose: true }).some((m) => m.to === square);

      if (isMatch) {
        const move = game.move({ from: selected, to: square, promotion: puzzle.solution.promotion });
        if (move) setLastMove({ from: selected, to: square });
        setFeedback("correct");
        setSolvedCount((c) => c + 1);
      } else {
        setFeedback("wrong");
        setTimeout(() => setFeedback(null), 700);
      }
      resetSelection();
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square);
      setLegalTargets(game.moves({ square, verbose: true }).map((m) => m.to as Square));
    } else {
      resetSelection();
    }
  }

  function handleRetry() {
    setFeedback(null);
    resetSelection();
    setLastMove(null);
  }

  function handleNext() {
    setIndex((i) => (i + 1) % PUZZLES.length);
    setFeedback(null);
    resetSelection();
    setLastMove(null);
  }

  return (
    <div className="puzzles-page">
      <div className="puzzles-layout">
        <div className="board-column">
          <div className="card puzzles-header">
            <div>
              <span className="puzzles-progress">
                Puzzle {index + 1} / {PUZZLES.length}
              </span>
              <h2>{puzzle.title}</h2>
              <p className="puzzles-description">{puzzle.description}</p>
            </div>
            <span className="badge">{solvedCount} résolus</span>
          </div>

          <div
            className={`status-bar ${feedback === "correct" ? "status-check" : ""} ${
              feedback === "wrong" ? "puzzles-status-wrong" : ""
            }`}
          >
            {feedback === "correct" && (
              <>
                <Check size={18} /> Bien joué !
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
            <button className="btn btn-ghost btn-sm" onClick={handleRetry} disabled={solved}>
              <RotateCcw size={16} />
              Recommencer ce puzzle
            </button>
            {solved && (
              <button className="btn btn-primary btn-sm" onClick={handleNext}>
                Puzzle suivant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
