import { Chess, type Square, type PieceSymbol } from "chess.js";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { DIFFICULTIES } from "../engine/difficulty";
import { StockfishEngine } from "../engine/stockfishEngine";
import { useGameSettings } from "../hooks/useGameSettings";
import { BOARD_THEMES } from "../theme/boardThemes";
import { PIECE_STYLES } from "../theme/pieceStyles";
import "../styles/watch.css";

// Both colors use the same (solid) glyph shapes, recolored via CSS.
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

function pieceValue(type: PieceSymbol): number {
  switch (type) {
    case "p":
      return 1;
    case "n":
    case "b":
      return 3;
    case "r":
      return 5;
    case "q":
      return 9;
    default:
      return 0;
  }
}

export function Watch() {
  const { settings } = useGameSettings();
  const boardTheme = BOARD_THEMES.find((t) => t.id === settings.boardThemeId) ?? BOARD_THEMES[0];
  const pieceStyle = PIECE_STYLES.find((p) => p.id === settings.pieceStyleId) ?? PIECE_STYLES[0];

  const gameRef = useRef(new Chess());
  const whiteEngineRef = useRef<StockfishEngine | null>(null);
  const blackEngineRef = useRef<StockfishEngine | null>(null);

  const [version, setVersion] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [thinking, setThinking] = useState(false);
  const [running, setRunning] = useState(true);
  const [enginesReady, setEnginesReady] = useState(false);
  const [difficultyId, setDifficultyId] = useState(DIFFICULTIES[1].id);

  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[1];

  const game = gameRef.current;
  const rerender = () => setVersion((v) => v + 1);

  const board = game.board();
  const turn = game.turn();
  const inCheck = game.inCheck();
  const isGameOver = game.isGameOver();

  // The engine drives both sides of the board — it's one AI playing out a full game, not two AIs facing off.
  useEffect(() => {
    const whiteEngine = new StockfishEngine();
    const blackEngine = new StockfishEngine();
    whiteEngineRef.current = whiteEngine;
    blackEngineRef.current = blackEngine;
    (async () => {
      await Promise.all([
        whiteEngine.setSkillLevel(difficulty.skillLevel),
        blackEngine.setSkillLevel(difficulty.skillLevel),
      ]);
      await Promise.all([whiteEngine.newGame(), blackEngine.newGame()]);
      setEnginesReady(true);
    })();
    return () => {
      whiteEngine.terminate();
      blackEngine.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A difficulty change takes effect starting with the next move played.
  useEffect(() => {
    whiteEngineRef.current?.setSkillLevel(difficulty.skillLevel);
    blackEngineRef.current?.setSkillLevel(difficulty.skillLevel);
  }, [difficulty]);

  // Whenever it's a side's turn (and playback is running), ask the engine for a move.
  useEffect(() => {
    if (!enginesReady || !running || isGameOver) return;
    const engine = turn === "w" ? whiteEngineRef.current : blackEngineRef.current;
    const movetimeMs = difficulty.movetimeMs;
    if (!engine) return;

    let cancelled = false;
    setThinking(true);
    engine.getBestMove(game.fen(), movetimeMs).then((uciMove) => {
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
  }, [version, running, enginesReady]);

  const checkSquare = useMemo(() => {
    if (!inCheck) return null;
    const king = board.flat().find((c) => c && c.type === "k" && c.color === turn);
    return king ? king.square : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, inCheck, turn]);

  const captured = useMemo(() => {
    const history = game.history({ verbose: true });
    const byWhite: PieceSymbol[] = [];
    const byBlack: PieceSymbol[] = [];
    for (const m of history) {
      if (m.captured) {
        if (m.color === "w") byWhite.push(m.captured as PieceSymbol);
        else byBlack.push(m.captured as PieceSymbol);
      }
    }
    const score = (list: PieceSymbol[]) => list.reduce((sum, t) => sum + pieceValue(t), 0);
    return {
      byWhite,
      byBlack,
      advantage: score(byWhite) - score(byBlack),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, version]);

  const statusText = useMemo(() => {
    if (game.isCheckmate()) return `Échec et mat — les ${turn === "w" ? "Noirs" : "Blancs"} gagnent.`;
    if (game.isStalemate()) return "Pat — partie nulle.";
    if (game.isThreefoldRepetition()) return "Nulle par répétition.";
    if (game.isInsufficientMaterial()) return "Nulle — matériel insuffisant.";
    if (game.isDrawByFiftyMoves()) return "Nulle — règle des 50 coups.";
    if (game.isDraw()) return "Partie nulle.";
    if (!enginesReady) return "Chargement de l'IA…";
    if (!running) return "En pause.";
    if (thinking) return "L'IA réfléchit…";
    if (inCheck) return `Échec au roi ${turn === "w" ? "blanc" : "noir"} !`;
    return `Trait aux ${turn === "w" ? "Blancs" : "Noirs"}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, version, turn, inCheck, thinking, running, enginesReady]);

  function handleNewGame() {
    gameRef.current = new Chess();
    setLastMove(null);
    setThinking(false);
    whiteEngineRef.current?.newGame();
    blackEngineRef.current?.newGame();
    setRunning(true);
    rerender();
  }

  return (
    <div className="watch-page">
      <div className="watch-layout">
        <div className="board-column">
          <div className="card match-controls">
            <div className="difficulty-picker">
              <label>
                <span className="difficulty-label">Niveau de l'IA</span>
                <select
                  className="input"
                  value={difficultyId}
                  onChange={(e) => setDifficultyId(e.target.value)}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="match-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setRunning((r) => !r)}
                disabled={!enginesReady || isGameOver}
              >
                {running ? <Pause size={16} /> : <Play size={16} />}
                {running ? "Pause" : "Reprendre"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleNewGame}>
                <RotateCcw size={16} />
                Nouvelle partie
              </button>
            </div>
          </div>

          <div
            className={`status-bar ${inCheck && !isGameOver ? "status-check" : ""} ${
              thinking ? "status-thinking" : ""
            }`}
          >
            {thinking && <span className="thinking-spinner" />}
            {statusText}
          </div>

          <ChessBoard
            board={board}
            selected={null}
            legalTargets={[]}
            lastMove={lastMove}
            checkSquare={checkSquare}
            orientation={orientation}
            disabled
            theme={boardTheme}
            pieceStyle={pieceStyle}
            showCoordinates={settings.showCoordinates}
            highlightLastMove={settings.highlightLastMove}
          />

          <div className="board-controls">
            <button className="btn btn-ghost btn-sm" onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))}>
              Retourner l'échiquier
            </button>
          </div>
        </div>

        <aside className="side-panel">
          <div className="card moves-card">
            <div className="moves-card-header">
              <h3>Coups joués</h3>
              <span className="live-badge">
                <span className="live-dot" />
                En direct
              </span>
            </div>
            <ol className="moves-list">
              {game.history().map((san, i) => (
                <li key={i}>{san}</li>
              ))}
            </ol>
            {game.history().length === 0 && <p className="captures-label">Aucun coup joué.</p>}
          </div>

          <div className="card">
            <h3>Captures</h3>
            <div className="captures-row">
              <span className="captures-label">Blancs ont pris</span>
              <div className="captures-pieces">
                {captured.byWhite.map((t, i) => (
                  <span key={i} className="piece piece-b captured-piece">
                    {PIECE_UNICODE[`b${t}`]}
                  </span>
                ))}
              </div>
            </div>
            <div className="captures-row">
              <span className="captures-label">Noirs ont pris</span>
              <div className="captures-pieces">
                {captured.byBlack.map((t, i) => (
                  <span key={i} className="piece piece-w captured-piece">
                    {PIECE_UNICODE[`w${t}`]}
                  </span>
                ))}
              </div>
            </div>
            {captured.advantage !== 0 && (
              <p className="captures-advantage">
                Avantage matériel : {captured.advantage > 0 ? "Blancs" : "Noirs"} +
                {Math.abs(captured.advantage)}
              </p>
            )}
          </div>
        </aside>
      </div>

      {isGameOver && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Partie terminée</h2>
            <p>{statusText}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleNewGame}>
                Nouvelle partie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
