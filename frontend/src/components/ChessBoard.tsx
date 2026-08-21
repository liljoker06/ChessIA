import type { CSSProperties } from "react";
import type { Square } from "chess.js";
import type { BoardTheme } from "../theme/boardThemes";
import "./ChessBoard.css";

type BoardCell = { square: Square; type: string; color: "w" | "b" } | null;

const PIECE_UNICODE: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

function isLightSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0;
}

interface ChessBoardProps {
  board: BoardCell[][];
  selected: Square | null;
  legalTargets: Square[];
  lastMove: { from: Square; to: Square } | null;
  checkSquare: Square | null;
  orientation: "w" | "b";
  onSquareClick?: (square: Square) => void;
  disabled?: boolean;
  theme?: BoardTheme;
  showCoordinates?: boolean;
  highlightLastMove?: boolean;
}

export function ChessBoard({
  board,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  orientation,
  onSquareClick,
  disabled,
  theme,
  showCoordinates = true,
  highlightLastMove = true,
}: ChessBoardProps) {
  const rows = orientation === "w" ? board : [...board].reverse().map((r) => [...r].reverse());
  const files = orientation === "w" ? "abcdefgh".split("") : "abcdefgh".split("").reverse();
  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];

  const themeStyle = theme
    ? ({
        "--board-light": theme.light,
        "--board-dark": theme.dark,
        "--board-highlight": theme.highlight,
      } as CSSProperties)
    : undefined;

  return (
    <div className="chessboard" role="grid" aria-label="Échiquier" style={themeStyle}>
      {rows.map((row, rIdx) => (
        <div className="board-row" role="row" key={ranks[rIdx]}>
          {row.map((cell, cIdx) => {
            const square = `${files[cIdx]}${ranks[rIdx]}` as Square;
            const light = isLightSquare(square);
            const isSelected = selected === square;
            const isTarget = legalTargets.includes(square);
            const isLastMove =
              highlightLastMove && lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheck = checkSquare === square;

            const classes = [
              "board-square",
              light ? "square-light" : "square-dark",
              isSelected ? "square-selected" : "",
              isLastMove ? "square-last-move" : "",
              isCheck ? "square-check" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={square}
                role="gridcell"
                type="button"
                className={classes}
                onClick={() => !disabled && onSquareClick?.(square)}
                aria-label={square}
                disabled={disabled}
              >
                {showCoordinates && cIdx === 0 && <span className="coord coord-rank">{ranks[rIdx]}</span>}
                {showCoordinates && rIdx === 7 && <span className="coord coord-file">{files[cIdx]}</span>}
                {cell && (
                  <span className={`piece piece-${cell.color}`}>
                    {PIECE_UNICODE[`${cell.color}${cell.type}`]}
                  </span>
                )}
                {isTarget && <span className={cell ? "move-hint move-hint-capture" : "move-hint"} />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
