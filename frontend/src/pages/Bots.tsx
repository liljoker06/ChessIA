import { Chess, type PieceSymbol, type Square } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { DIFFICULTIES } from "../engine/difficulty";
import { StockfishEngine } from "../engine/stockfishEngine";
import { useGameHistory } from "../hooks/useGameHistory";
import { useGameSettings } from "../hooks/useGameSettings";
import { BOARD_THEMES } from "../theme/boardThemes";
import { PIECE_STYLES } from "../theme/pieceStyles";
import "../styles/watch.css";
import "../styles/bots.css";

type ColorChoice = "w" | "b" | "random";

const PROMOTION_PIECES: { type: PieceSymbol; label: string }[] = [
  { type: "q", label: "Dame" },
  { type: "r", label: "Tour" },
  { type: "b", label: "Fou" },
  { type: "n", label: "Cavalier" },
];

// Both colors use the same (solid) glyph shapes, recolored via CSS.
const PIECE_UNICODE: Record<string, string> = {
  wq: "♛",
  wr: "♜",
  wb: "♝",
  wn: "♞",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
};

export function Bots() {
  const [started, setStarted] = useState(false);
  const [colorChoice, setColorChoice] = useState<ColorChoice>("w");
  const [difficultyId, setDifficultyId] = useState(DIFFICULTIES[1].id);
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");

  const gameRef = useRef(new Chess());
  const engineRef = useRef<StockfishEngine | null>(null);

  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [thinking, setThinking] = useState(false);
  const [enginesReady, setEnginesReady] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[1];
  const { settings } = useGameSettings();
  const { addGame } = useGameHistory();
  const boardTheme = BOARD_THEMES.find((t) => t.id === settings.boardThemeId) ?? BOARD_THEMES[0];
  const pieceStyle = PIECE_STYLES.find((p) => p.id === settings.pieceStyleId) ?? PIECE_STYLES[0];
  const recordedRef = useRef(false);

  const game = gameRef.current;
  const rerender = () => setVersion((v) => v + 1);

  const board = game.board();
  const turn = game.turn();
  const inCheck = game.inCheck();
  const isGameOver = game.isGameOver();
  const isPlayerTurn = turn === playerColor && !pendingPromotion;

  useEffect(() => {
    if (!started) return;
    const engine = new StockfishEngine();
    engineRef.current = engine;
    (async () => {
      await engine.setSkillLevel(difficulty.skillLevel);
      await engine.newGame();
      setEnginesReady(true);
    })();
    return () => engine.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    if (!started || !enginesReady || isGameOver || turn === playerColor) return;
    const engine = engineRef.current;
    if (!engine) return;

    let cancelled = false;
    setThinking(true);
    engine.getBestMove(game.fen(), difficulty.movetimeMs).then((uciMove) => {
      if (cancelled || !uciMove) return;
      const from = uciMove.slice(0, 2) as Square;
      const to = uciMove.slice(2, 4) as Square;
      const promotion = uciMove.length > 4 ? (uciMove[4] as PieceSymbol) : undefined;
      const move = game.move({ from, to, promotion });
      if (move) setLastMove({ from, to });
      setThinking(false);
      rerender();
    });
    return () => {
      cancelled = true;
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, started, enginesReady, playerColor]);

  useEffect(() => {
    if (!isGameOver || recordedRef.current) return;
    recordedRef.current = true;

    let status = "draw";
    let result: "win" | "loss" | "draw" = "draw";
    if (game.isCheckmate()) {
      status = "checkmate";
      const winner = turn === "w" ? "b" : "w";
      result = winner === playerColor ? "win" : "loss";
    } else if (game.isStalemate()) {
      status = "stalemate";
    } else if (game.isThreefoldRepetition()) {
      status = "repetition";
    } else if (game.isInsufficientMaterial()) {
      status = "insufficient-material";
    } else if (game.isDrawByFiftyMoves()) {
      status = "fifty-moves";
    }

    addGame({
      difficulty: difficulty.label,
      playerColor,
      result,
      status,
      moveCount: game.history().length,
      finalFen: game.fen(),
      firstMoveSan: game.history()[0] ?? "",
      pgn: game.pgn(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver]);

  function handleStart() {
    const color: "w" | "b" = colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : colorChoice;
    gameRef.current = new Chess();
    recordedRef.current = false;
    setPlayerColor(color);
    setOrientation(color);
    setSelected(null);
    setLegalTargets([]);
    setLastMove(null);
    setPendingPromotion(null);
    setEnginesReady(false);
    setStarted(true);
    rerender();
  }

  function handleBackToSetup() {
    engineRef.current?.terminate();
    setStarted(false);
  }

  function handleNewGame() {
    gameRef.current = new Chess();
    recordedRef.current = false;
    setSelected(null);
    setLegalTargets([]);
    setLastMove(null);
    setPendingPromotion(null);
    engineRef.current?.newGame();
    rerender();
  }

  function isPromotionMove(from: Square, to: Square) {
    const piece = game.get(from);
    if (!piece || piece.type !== "p") return false;
    const targetRank = to[1];
    return (piece.color === "w" && targetRank === "8") || (piece.color === "b" && targetRank === "1");
  }

  function handleSquareClick(square: Square) {
    if (!isPlayerTurn || isGameOver) return;

    if (selected && legalTargets.includes(square)) {
      if (isPromotionMove(selected, square)) {
        setPendingPromotion({ from: selected, to: square });
        setSelected(null);
        setLegalTargets([]);
        return;
      }
      const move = game.move({ from: selected, to: square });
      if (move) setLastMove({ from: selected, to: square });
      setSelected(null);
      setLegalTargets([]);
      rerender();
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
      setSelected(square);
      setLegalTargets(game.moves({ square, verbose: true }).map((m) => m.to as Square));
    } else {
      setSelected(null);
      setLegalTargets([]);
    }
  }

  function handlePromotionPick(type: PieceSymbol) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    const move = game.move({ from, to, promotion: type });
    if (move) setLastMove({ from, to });
    setPendingPromotion(null);
    rerender();
  }

  const statusText = (() => {
    if (game.isCheckmate()) return `Échec et mat — ${turn === playerColor ? "l'IA gagne" : "tu gagnes"} !`;
    if (game.isStalemate()) return "Pat — partie nulle.";
    if (game.isThreefoldRepetition()) return "Nulle par répétition.";
    if (game.isInsufficientMaterial()) return "Nulle — matériel insuffisant.";
    if (game.isDrawByFiftyMoves()) return "Nulle — règle des 50 coups.";
    if (game.isDraw()) return "Partie nulle.";
    if (!enginesReady) return "Chargement de l'IA…";
    if (thinking) return "L'IA réfléchit…";
    if (inCheck) return "Échec !";
    return isPlayerTurn ? "À toi de jouer" : "Trait à l'IA";
  })();

  if (!started) {
    return (
      <div className="bots-setup-page">
        <div className="card bots-setup-card">
          <h1>Jouer contre un bot</h1>
          <p className="bots-setup-subtitle">Choisis ta couleur et le niveau de l'adversaire.</p>

          <div className="field">
            <label>Couleur</label>
            <div className="choice-row">
              {(
                [
                  { id: "w", label: "Blancs" },
                  { id: "b", label: "Noirs" },
                  { id: "random", label: "Aléatoire" },
                ] as { id: ColorChoice; label: string }[]
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`btn ${colorChoice === c.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setColorChoice(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Difficulté</label>
            <div className="choice-row">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`btn ${difficultyId === d.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setDifficultyId(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-block" onClick={handleStart}>
            Commencer la partie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bots-page">
      <div className="board-column">
        <div className="card match-controls">
          <span className="badge">Contre l'IA — {difficulty.label}</span>
          <div className="match-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))}>
              Retourner l'échiquier
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleBackToSetup}>
              Changer les réglages
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleNewGame}>
              Nouvelle partie
            </button>
          </div>
        </div>

        <div className={`status-bar ${inCheck && !isGameOver ? "status-check" : ""} ${thinking ? "status-thinking" : ""}`}>
          {thinking && <span className="thinking-spinner" />}
          {statusText}
        </div>

        <ChessBoard
          board={board}
          selected={selected}
          legalTargets={legalTargets}
          lastMove={lastMove}
          checkSquare={null}
          orientation={orientation}
          onSquareClick={handleSquareClick}
          disabled={!isPlayerTurn || isGameOver}
          theme={boardTheme}
          pieceStyle={pieceStyle}
          showCoordinates
          highlightLastMove
        />

        {pendingPromotion && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Promotion</h2>
              <p>Choisis la pièce pour ton pion.</p>
              <div className="promotion-choices">
                {PROMOTION_PIECES.map((p) => (
                  <button key={p.type} className="promotion-choice" onClick={() => handlePromotionPick(p.type)}>
                    <span className="piece">{PIECE_UNICODE[`${playerColor}${p.type}`]}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isGameOver && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Partie terminée</h2>
              <p>{statusText}</p>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleNewGame}>
                  Nouvelle partie
                </button>
                <button className="btn btn-ghost" onClick={handleBackToSetup}>
                  Changer les réglages
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
