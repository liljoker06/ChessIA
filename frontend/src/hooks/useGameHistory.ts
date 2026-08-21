import { useEffect, useState } from "react";

/**
 * Local game log, loosely modeled on the shape of a Lichess game record
 * (players, result, status, move count) — but entirely client-side, no API call.
 */
export interface HistoryGame {
  id: string;
  date: number;
  difficulty: string;
  playerColor: "w" | "b";
  result: "win" | "loss" | "draw";
  status: string;
  moveCount: number;
  finalFen: string;
  firstMoveSan: string;
  pgn: string;
  favorite: boolean;
}

const STORAGE_KEY = "chess-history";
const MAX_ENTRIES = 100;

// Sample rows shown until the player has real games of their own — same shape as a real entry,
// just not tied to an actual played game.
export const SAMPLE_GAMES: HistoryGame[] = [
  {
    id: "sample-1",
    date: Date.now() - 2 * 24 * 3600_000,
    difficulty: "Moyen",
    playerColor: "w",
    result: "win",
    status: "checkmate",
    moveCount: 25,
    finalFen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1",
    firstMoveSan: "d4",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6",
    favorite: false,
  },
  {
    id: "sample-2",
    date: Date.now() - 6 * 24 * 3600_000,
    difficulty: "Facile",
    playerColor: "w",
    result: "win",
    status: "checkmate",
    moveCount: 8,
    finalFen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
    firstMoveSan: "d4",
    pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7",
    favorite: false,
  },
  {
    id: "sample-3",
    date: Date.now() - 9 * 24 * 3600_000,
    difficulty: "Difficile",
    playerColor: "b",
    result: "win",
    status: "checkmate",
    moveCount: 15,
    finalFen: "7k/5ppp/8/8/8/8/8/Q6K w - - 0 1",
    firstMoveSan: "Nf3",
    pgn: "1. Nf3 Nf6 2. Nc3 d5",
    favorite: false,
  },
  {
    id: "sample-4",
    date: Date.now() - 13 * 24 * 3600_000,
    difficulty: "Moyen",
    playerColor: "b",
    result: "loss",
    status: "checkmate",
    moveCount: 39,
    finalFen: "4r1k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
    firstMoveSan: "e4",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
    favorite: false,
  },
];

function readHistory(): HistoryGame[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useGameHistory() {
  const [games, setGames] = useState<HistoryGame[]>(readHistory);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  }, [games]);

  function addGame(entry: Omit<HistoryGame, "id" | "date" | "favorite">) {
    const game: HistoryGame = { ...entry, id: crypto.randomUUID(), date: Date.now(), favorite: false };
    setGames((g) => [game, ...g].slice(0, MAX_ENTRIES));
  }

  function toggleFavorite(id: string) {
    setGames((g) => g.map((game) => (game.id === id ? { ...game, favorite: !game.favorite } : game)));
  }

  function deleteGame(id: string) {
    setGames((g) => g.filter((game) => game.id !== id));
  }

  const stats = {
    total: games.length,
    wins: games.filter((g) => g.result === "win").length,
    losses: games.filter((g) => g.result === "loss").length,
    draws: games.filter((g) => g.result === "draw").length,
  };

  return { games, addGame, toggleFavorite, deleteGame, stats };
}
