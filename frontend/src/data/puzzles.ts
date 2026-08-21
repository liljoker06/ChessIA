import type { PieceSymbol, Square } from "chess.js";

export interface Puzzle {
  id: string;
  fen: string;
  title: string;
  description: string;
  solution: { from: Square; to: Square; promotion?: PieceSymbol };
}

/**
 * Small set of basic, hand-verified tactics (back-rank mates, a simple fork,
 * a hanging piece). Not drawn from any real game or attributed to anyone —
 * just constructed positions for practice.
 */
export const PUZZLES: Puzzle[] = [
  {
    id: "back-rank-1",
    fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1",
    title: "Mat en 1",
    description: "Le roi noir est enfermé par ses propres pions. Trouve le mat en un coup.",
    solution: { from: "e1", to: "e8" },
  },
  {
    id: "fools-mate",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
    title: "Mat en 1",
    description: "Les Blancs ont beaucoup trop affaibli leur roi. Trouve le mat immédiat.",
    solution: { from: "d8", to: "h4" },
  },
  {
    id: "back-rank-2",
    fen: "4r1k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
    title: "Mat en 1",
    description: "À ton tour de profiter d'une première rangée dégarnie.",
    solution: { from: "e8", to: "e1" },
  },
  {
    id: "hanging-piece",
    fen: "4k3/8/8/n7/8/8/3Q4/4K3 w - - 0 1",
    title: "Gagne une pièce",
    description: "Un cavalier noir traîne sans protection. Capture-le.",
    solution: { from: "d2", to: "a5" },
  },
  {
    id: "back-rank-3",
    fen: "7k/5ppp/8/8/8/8/8/Q6K w - - 0 1",
    title: "Mat en 1",
    description: "La dame peut se déplacer sur toute la colonne et la rangée. Trouve le mat.",
    solution: { from: "a1", to: "a8" },
  },
];
