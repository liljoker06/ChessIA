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
