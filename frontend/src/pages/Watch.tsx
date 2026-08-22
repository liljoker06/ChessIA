import { Chess, type Square, type PieceSymbol } from "chess.js";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChessBoard } from "../components/ChessBoard";
import { DIFFICULTIES } from "../engine/difficulty";
import { StockfishEngine } from "../engine/stockfishEngine";
import { useGameSettings } from "../hooks/useGameSettings";
import { type HistoryGame } from "../hooks/useGameHistory";
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

type WatchLocationState = {
  replayGame?: HistoryGame;
  liveGameId?: string;
};

type LiveEvent = {
  fen: string;
  moves: string; // space-separated UCI moves played so far
  last_move: string | null;
  status: string | null;
  turn: "w" | "b";
  bot_color?: "w" | "b";
  error?: string;
  speed?: string;
  perf?: string;
  clock_initial_ms?: number;
  clock_increment_ms?: number;
  white_ai_level?: number;
  black_ai_level?: number;
  wtime_ms?: number;
  btime_ms?: number;
};

function formatClock(ms: number | undefined): string {
  if (ms === undefined) return "--:--";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const API_URL = import.meta.env.VITE_API_URL;

function parseReplayMoves(pgn: string): string[] {
  const moveSection = pgn
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[/.test(line))
    .join(" ");

  return moveSection
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n]*/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(?:\.\.\.)?/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !/^\[/.test(token) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token));
}

function buildReplayGame(replayGame: HistoryGame, moveCount: number) {
  const replayMoves = parseReplayMoves(replayGame.pgn).slice(0, moveCount);
  const chess = new Chess();
  for (const san of replayMoves) {
    const move = chess.move(san, { sloppy: true } as any);
    if (!move) break;
  }
  return chess;
}

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
  const location = useLocation();
  const locationState = location.state as WatchLocationState | null;
  const [replayGameState, setReplayGameState] = useState<HistoryGame | undefined>(locationState?.replayGame);
  const isReplayMode = replayGameState !== undefined;

  const [liveGameId, setLiveGameId] = useState<string | undefined>(locationState?.liveGameId);
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const isLiveMode = liveGameId !== undefined && !isReplayMode;
  const { settings } = useGameSettings();
  const boardTheme = BOARD_THEMES.find((t) => t.id === settings.boardThemeId) ?? BOARD_THEMES[0];
  const pieceStyle = PIECE_STYLES.find((p) => p.id === settings.pieceStyleId) ?? PIECE_STYLES[0];

  const gameRef = useRef(new Chess());
  const whiteEngineRef = useRef<StockfishEngine | null>(null);
  const blackEngineRef = useRef<StockfishEngine | null>(null);

  const [version, setVersion] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [thinking, setThinking] = useState(false);
  const [running, setRunning] = useState(true);
  const [enginesReady, setEnginesReady] = useState(false);
  const [difficultyId, setDifficultyId] = useState(DIFFICULTIES[1].id);

  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[1];
  const replayMoves = useMemo(() => (replayGameState ? parseReplayMoves(replayGameState.pgn) : []), [replayGameState]);
  const replayGame = useMemo(
    () => (replayGameState ? buildReplayGame(replayGameState, replayIndex) : null),
    [replayGameState, replayIndex, replayMoves]
  );
  const replayLastMove = useMemo(() => {
    if (!replayGameState || replayIndex === 0) return null;
    const history = replayGame?.history({ verbose: true }) ?? [];
    const last = history[history.length - 1];
    return last ? { from: last.from as Square, to: last.to as Square } : null;
  }, [replayGameState, replayGame, replayIndex]);

  const liveGame = useMemo(() => {
    if (!isLiveMode || !liveEvent) return null;
    // Replay every UCI move from scratch (rather than just loading the
    // current FEN) so chess.js has full move history -- needed for the
    // moves list and captures panel to work in live mode.
    const chess = new Chess();
    for (const uci of (liveEvent.moves ?? "").split(" ").filter(Boolean)) {
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      } catch {
        break;
      }
    }
    return chess;
  }, [isLiveMode, liveEvent]);

  const liveLastMove = useMemo(() => {
    if (!liveEvent?.last_move) return null;
    const uci = liveEvent.last_move;
    return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
  }, [liveEvent]);

  const game = isLiveMode ? liveGame ?? new Chess() : replayGameState ? replayGame ?? gameRef.current : gameRef.current;
  const rerender = () => setVersion((v) => v + 1);

  const board = game.board();
  const turn = game.turn();
  const inCheck = game.inCheck();
  const isGameOver = game.isGameOver();
  const liveWaiting = isLiveMode && liveEvent?.status === "waiting_for_opponent";
  const liveFinished =
    isLiveMode &&
    liveEvent?.status !== null &&
    liveEvent?.status !== undefined &&
    liveEvent?.status !== "started" &&
    liveEvent?.status !== "waiting_for_opponent";
  const isGameOverEffective = isLiveMode ? isGameOver || liveFinished : isGameOver;

  // No liveGameId passed via navigation (e.g. page refresh) -- check if this
  // session already has a live game running.
  useEffect(() => {
    if (liveGameId || isReplayMode) return;
    const token = localStorage.getItem("chess-api-token");
    if (!token) return;

    fetch(`${API_URL}/api/play/current`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.game_id) setLiveGameId(data.game_id);
      })
      .catch(() => {});
  }, [liveGameId, isReplayMode]);

  // The SSE stream only pushes an update on every move, not every second --
  // tick a local render every 250ms while live so the clock visibly counts down.
  const lastEventAtRef = useRef(Date.now());
  const [, setClockTick] = useState(0);

  useEffect(() => {
    if (!isLiveMode || !liveGameId) return;

    const source = new EventSource(`${API_URL}/api/play/stream/${liveGameId}`);
    source.onmessage = (msg) => {
      try {
        setLiveEvent(JSON.parse(msg.data));
        lastEventAtRef.current = Date.now();
      } catch {
        // ignore malformed events
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [isLiveMode, liveGameId]);

  useEffect(() => {
    if (!isLiveMode || liveFinished) return;
    const id = window.setInterval(() => setClockTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [isLiveMode, liveFinished]);

  const displayedWtimeMs = useMemo(() => {
    if (liveEvent?.wtime_ms === undefined) return undefined;
    const elapsed = turn === "w" ? Date.now() - lastEventAtRef.current : 0;
    return Math.max(0, liveEvent.wtime_ms - elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent, turn, /* re-run every tick: */ Math.floor(Date.now() / 250)]);

  const displayedBtimeMs = useMemo(() => {
    if (liveEvent?.btime_ms === undefined) return undefined;
    const elapsed = turn === "b" ? Date.now() - lastEventAtRef.current : 0;
    return Math.max(0, liveEvent.btime_ms - elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent, turn, Math.floor(Date.now() / 250)]);

  useEffect(() => {
    if (!isReplayMode) return;

    gameRef.current = new Chess();
    setLastMove(null);
    setReplayIndex(0);
    setThinking(false);
    setRunning(true);
    setEnginesReady(false);
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReplayMode, replayMoves]);

  useEffect(() => {
    if (!isReplayMode || !running) return;
    if (replayIndex >= replayMoves.length) return;

    const timeoutId = window.setTimeout(() => {
      setReplayIndex((current) => Math.min(current + 1, replayMoves.length));
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [isReplayMode, running, replayIndex, replayMoves.length]);

  // The engine drives both sides of the board — it's one AI playing out a full game, not two AIs facing off.
  useEffect(() => {
    if (isReplayMode || isLiveMode) return;

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
  }, [isReplayMode, isLiveMode]);

  // A difficulty change takes effect starting with the next move played.
  useEffect(() => {
    if (isReplayMode || isLiveMode) return;
    whiteEngineRef.current?.setSkillLevel(difficulty.skillLevel);
    blackEngineRef.current?.setSkillLevel(difficulty.skillLevel);
  }, [difficulty, isReplayMode, isLiveMode]);

  // Whenever it's a side's turn (and playback is running), ask the engine for a move.
  useEffect(() => {
    if (isReplayMode || isLiveMode || !enginesReady || !running || isGameOver) return;
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
  }, [version, running, enginesReady, isReplayMode, isLiveMode]);

  useEffect(() => {
    if (!isReplayMode) return;
    setLastMove(replayLastMove);
  }, [isReplayMode, replayLastMove]);

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
    if (isReplayMode) {
      return `Relecture de la partie du ${new Date(replayGameState.date).toLocaleDateString("fr-FR")} (${replayIndex}/${replayMoves.length}).`;
    }
    if (isLiveMode) {
      if (!liveEvent) return "Connexion à la partie Lichess…";
      if (liveEvent.status === "waiting_for_opponent") return "En attente que l'adversaire accepte le défi…";
      if (liveEvent.status === "challenge_expired") return "Le défi n'a pas été accepté à temps (annulé).";
      if (liveEvent.status === "resigned") return "L'IA a abandonné (coup illégal généré).";
      if (liveEvent.status === "error") return "Erreur de connexion à la partie.";
      if (liveFinished) return "Partie terminée.";
      return `Trait aux ${turn === "w" ? "Blancs" : "Noirs"} — partie en direct sur Lichess`;
    }
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
  }, [game, version, turn, inCheck, thinking, running, enginesReady, isReplayMode, replayGameState, replayIndex, replayMoves.length, isLiveMode, liveEvent, liveFinished]);

  function handleNewGame() {
    setReplayGameState(undefined);
    gameRef.current = new Chess();
    setLastMove(null);
    setThinking(false);
    whiteEngineRef.current?.newGame();
    blackEngineRef.current?.newGame();
    setRunning(true);
    rerender();
  }

  function handleReplayToggle() {
    if (!isReplayMode) {
      setRunning((current) => !current);
      return;
    }

    setRunning((current) => {
      if (current) return false;
      if (replayIndex >= replayMoves.length) {
        setReplayIndex(0);
      }
      return true;
    });
  }

  function handleReplayJump(moveIndex: number) {
    setReplayIndex(moveIndex);
    setRunning(false);
  }

  return (
    <div className="watch-page">
      <div className="watch-layout">
        <div className="board-column">
          {!isLiveMode && (
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
                  onClick={handleReplayToggle}
                  disabled={!isReplayMode && (!enginesReady || isGameOver)}
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
          )}

          {isLiveMode && liveEvent && !liveWaiting && liveEvent.fen && (
            <div className="card match-controls">
              <div className="live-info">
                <span className="badge">
                  {liveEvent.perf ?? liveEvent.speed ?? "Partie"}
                  {liveEvent.clock_initial_ms != null &&
                    ` · ${Math.round(liveEvent.clock_initial_ms / 60000)}+${Math.round((liveEvent.clock_increment_ms ?? 0) / 1000)}`}
                  {" · vs. IA Lichess"}
                  {liveEvent.white_ai_level != null && ` niveau ${liveEvent.white_ai_level}`}
                  {liveEvent.black_ai_level != null && ` niveau ${liveEvent.black_ai_level}`}
                </span>
                {liveEvent.bot_color && (
                  <span className={`badge badge-bot-color badge-bot-color-${liveEvent.bot_color}`}>
                    Notre IA joue les {liveEvent.bot_color === "w" ? "Blancs" : "Noirs"}
                  </span>
                )}
              </div>
              <div className="match-actions live-clocks">
                <span className={`live-clock ${turn === "b" ? "live-clock-active" : ""} ${liveEvent.bot_color === "b" ? "live-clock-bot" : ""}`}>
                  ♟ {formatClock(displayedBtimeMs)}
                </span>
                <span className={`live-clock ${turn === "w" ? "live-clock-active" : ""} ${liveEvent.bot_color === "w" ? "live-clock-bot" : ""}`}>
                  ♙ {formatClock(displayedWtimeMs)}
                </span>
              </div>
            </div>
          )}

          <div
            className={`status-bar ${inCheck && !isGameOverEffective ? "status-check" : ""} ${
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
            lastMove={isLiveMode ? liveLastMove : replayGameState ? replayLastMove : lastMove}
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
              {replayGameState ? <span className="live-badge">Partie historique</span> : <span className="live-badge">
                <span className="live-dot" />
                En direct
              </span>}
            </div>
            <ol className="moves-list">
              {replayGameState
                ? replayMoves.map((san, i) => {
                    const moveNumber = Math.floor(i / 2) + 1;
                    const isWhiteMove = i % 2 === 0;
                    const isCurrent = i === replayIndex - 1;

                    return (
                      <li key={i} className={isCurrent ? "moves-list-item-active" : undefined}>
                        <button
                          type="button"
                          className="replay-move-number"
                          onClick={() => handleReplayJump(i + 1)}
                          aria-label={`Aller au coup ${moveNumber}${isWhiteMove ? "." : "..."}`}
                        >
                          {moveNumber}{isWhiteMove ? "." : "..."}
                          <span className="replay-move-san">{san}</span>
                        </button>
                        
                      </li>
                    );
                  })
                : game.history().map((san, i) => <li key={i}>{san}</li>)}
            </ol>
            {(replayGameState ? replayMoves.length : game.history().length) === 0 && (
              <p className="captures-label">Aucun coup joué.</p>
            )}
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

      {!replayGameState && !isLiveMode && isGameOver && (
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

      {isLiveMode && liveFinished && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Partie terminée</h2>
            <p>{statusText}</p>
            <div className="modal-actions">
              <a className="btn btn-primary" href={`https://lichess.org/${liveGameId}`} target="_blank" rel="noreferrer">
                Voir sur Lichess
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
