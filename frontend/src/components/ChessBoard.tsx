import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Square } from "chess.js";
import type { BoardTheme } from "../theme/boardThemes";
import type { PieceStyle } from "../theme/pieceStyles";
import "./ChessBoard.css";

type BoardCell = { square: Square; type: string; color: "w" | "b" } | null;

// Both colors use the same (solid) glyph shapes, recolored via CSS — the dedicated
// "white piece" Unicode characters are hollow outlines and render inconsistently
// with the black pieces when colorized.
const PIECE_UNICODE: Record<string, string> = {
  wp: "♟",
  wn: "♞",
  wb: "♝",
  wr: "♜",
  wq: "♛",
  wk: "♚",
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

function squarePosition(square: Square, orientation: "w" | "b"): { left: string; top: string } {
  const fileIdx = square.charCodeAt(0) - "a".charCodeAt(0);
  const rankIdx = 8 - Number(square[1]);
  const col = orientation === "w" ? fileIdx : 7 - fileIdx;
  const row = orientation === "w" ? rankIdx : 7 - rankIdx;
  return { left: `${col * 12.5}%`, top: `${row * 12.5}%` };
}

type AnimatingPiece = { type: string; color: "w" | "b"; from: Square; to: Square; phase: "start" | "end" };

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
  pieceStyle?: PieceStyle;
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
  pieceStyle,
  showCoordinates = true,
  highlightLastMove = true,
}: ChessBoardProps) {
  const rows = orientation === "w" ? board : [...board].reverse().map((r) => [...r].reverse());
  const files = orientation === "w" ? "abcdefgh".split("") : "abcdefgh".split("").reverse();
  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];

  const [animPiece, setAnimPiece] = useState<AnimatingPiece | null>(null);
  const prevLastMoveRef = useRef<{ from: Square; to: Square } | null>(null);

  // Slide the moved piece from its origin to its destination square instead
  // of having it just pop into place -- only the moved piece animates
  // (captures/castling/promotion snap instantly, a fine simplification).
  useEffect(() => {
    if (!lastMove) {
      prevLastMoveRef.current = null;
      return;
    }
    const isSameMove =
      prevLastMoveRef.current?.from === lastMove.from && prevLastMoveRef.current?.to === lastMove.to;
    prevLastMoveRef.current = lastMove;
    if (isSameMove) return;

    const movedCell = board.flat().find((c) => c && c.square === lastMove.to);
    if (!movedCell) return;

    setAnimPiece({ type: movedCell.type, color: movedCell.color, from: lastMove.from, to: lastMove.to, phase: "start" });
    const raf = requestAnimationFrame(() => setAnimPiece((p) => (p ? { ...p, phase: "end" } : p)));
    const timeout = window.setTimeout(() => setAnimPiece(null), 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMove?.from, lastMove?.to]);

  const boardStyle = {
    ...(theme
      ? {
          "--board-light": theme.light,
          "--board-dark": theme.dark,
          "--board-highlight": theme.highlight,
        }
      : {}),
    ...(pieceStyle
      ? {
          "--piece-w-fill": pieceStyle.whiteFill,
          "--piece-w-stroke": pieceStyle.whiteStroke,
          "--piece-b-fill": pieceStyle.blackFill,
          "--piece-b-stroke": pieceStyle.blackStroke,
        }
      : {}),
  } as CSSProperties;

  return (
    <div className="chessboard" role="grid" aria-label="Échiquier" style={boardStyle}>
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
                {cell && !(animPiece && animPiece.to === square) && (
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
      {animPiece && (
        <div className="board-anim-layer">
          <span
            className={`piece piece-${animPiece.color} board-anim-piece`}
            style={squarePosition(animPiece.phase === "start" ? animPiece.from : animPiece.to, orientation)}
          >
            {PIECE_UNICODE[`${animPiece.color}${animPiece.type}`]}
          </span>
        </div>
      )}
    </div>
  );
}
