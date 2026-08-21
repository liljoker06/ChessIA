/**
 * Thin UCI wrapper around the Stockfish 18 (lite, single-threaded WASM) worker.
 * Files live in public/engine/ so they're served as static assets and the
 * worker can load its own .wasm relative to itself, without bundler involvement.
 */

const ENGINE_URL = "/engine/stockfish-18-lite-single.js";

export class StockfishEngine {
  private worker: Worker;
  private ready: Promise<void>;
  private terminated = false;

  constructor() {
    this.worker = new Worker(ENGINE_URL);
    // A React StrictMode double-mount can terminate this worker mid-init;
    // without this, the WASM abort surfaces as an unhandled worker error.
    this.worker.onerror = (e) => {
      if (this.terminated) e.preventDefault();
    };
    this.ready = this.handshake();
  }

  private send(command: string) {
    if (this.terminated) return;
    this.worker.postMessage(command);
  }

  private waitFor(predicate: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const handler = (e: MessageEvent<string>) => {
        if (predicate(e.data)) {
          this.worker.removeEventListener("message", handler);
          resolve(e.data);
        }
      };
      this.worker.addEventListener("message", handler);
    });
  }

  private async handshake() {
    this.send("uci");
    await this.waitFor((l) => l === "uciok");
    this.send("isready");
    await this.waitFor((l) => l === "readyok");
  }

  async setSkillLevel(level: number) {
    await this.ready;
    this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, level))}`);
  }

  async newGame() {
    await this.ready;
    this.send("ucinewgame");
  }

  /** Returns a UCI move like "e2e4" or "e7e8q" for promotion. */
  async getBestMove(fen: string, movetimeMs: number): Promise<string> {
    await this.ready;
    const result = this.waitFor((l) => l.startsWith("bestmove"));
    this.send(`position fen ${fen}`);
    this.send(`go movetime ${movetimeMs}`);
    const line = await result;
    return line.split(" ")[1];
  }

  /** Interrupts an in-flight `getBestMove` search; it still resolves with a (weaker) move. */
  stop() {
    this.send("stop");
  }

  terminate() {
    this.terminated = true;
    this.worker.terminate();
  }
}
