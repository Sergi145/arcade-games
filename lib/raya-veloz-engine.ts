import type { RealGameState } from "@/components/real-game-registry";

export type RayaVelozEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type RayaVelozEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

const W = 800;
const H = 600;

const COLS = 7;
const ROWS = 6;
const CELL = 64;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const BOARD_X = (W - BOARD_W) / 2;
const BOARD_Y = 150;

const MAGENTA = "#ff006e";
const CYAN = "#00f5ff";
const YELLOW = "#f5ff00";
const INK = "#e6e9ff";
const PANEL = "#150a2a";
const HOLE = "#050310";

const MAX_LEVEL = 5;
const FALL_DURATION = 0.25;
const RESULT_PAUSE = 1.1;
const LIVES_START = 3;

const turnTime = (level: number) => Math.max(3.0, 5.0 - 0.5 * (level - 1));
const iaThinkTime = (level: number) => Math.max(0.4, 1.2 - 0.2 * (level - 1));

type Cell = 0 | 1 | 2; // 0 vacío, 1 jugador, 2 IA
type Board = Cell[][]; // [ROWS][COLS]

type Phase =
  | "esperando_jugador"
  | "cayendo"
  | "pensando_ia"
  | "ronda_fin"
  | "gameover";

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "Space"]);

export function createRayaVelozEngine(
  canvas: HTMLCanvasElement,
  callbacks: RayaVelozEngineCallbacks,
): RayaVelozEngineHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  let board: Board = [];
  let piecesPlaced = 0;
  let phase: Phase = "esperando_jugador";
  let paused = false;
  let cursorCol = 3;
  let turnTimer = 0;
  let iaTimer = 0;

  let fallOwner: 1 | 2 = 1;
  let fallCol = 0;
  let fallRow = 0;
  let fallProgress = 0;

  let resultText = "";
  let resultColor = INK;
  let resultTimer = 0;

  let roundsJugador = 0;
  let roundsIA = 0;

  let score = 0;
  let lives = LIVES_START;
  let level = 1;
  let gameOver = false;

  function emptyBoard(): Board {
    return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
  }

  function landingRow(col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) return r;
    }
    return -1;
  }

  function checkWinAt(r: number, c: number, owner: Cell): boolean {
    const dirs: [number, number][] = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    for (const [dx, dy] of dirs) {
      let count = 1;
      let rr = r + dy;
      let cc = c + dx;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === owner) {
        count++;
        rr += dy;
        cc += dx;
      }
      rr = r - dy;
      cc = c - dx;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === owner) {
        count++;
        rr -= dy;
        cc -= dx;
      }
      if (count >= 4) return true;
    }
    return false;
  }

  function wouldWin(owner: Cell, col: number): boolean {
    const r = landingRow(col);
    if (r === -1) return false;
    board[r][col] = owner;
    const win = checkWinAt(r, col, owner);
    board[r][col] = 0;
    return win;
  }

  function availableColumns(): number[] {
    const cols: number[] = [];
    for (let c = 0; c < COLS; c++) if (landingRow(c) !== -1) cols.push(c);
    return cols;
  }

  function weightedPick(cols: number[]): number {
    const weights = cols.map((c) => 4 - Math.abs(c - 3));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < cols.length; i++) {
      r -= weights[i];
      if (r <= 0) return cols[i];
    }
    return cols[cols.length - 1];
  }

  function iaChooseColumn(): number {
    const avail = availableColumns();
    for (const c of avail) if (wouldWin(2, c)) return c;
    for (const c of avail) if (wouldWin(1, c)) return c;
    return weightedPick(avail);
  }

  function beginFall(owner: 1 | 2, col: number) {
    const row = landingRow(col);
    fallOwner = owner;
    fallCol = col;
    fallRow = row;
    fallProgress = 0;
    phase = "cayendo";
  }

  function startNewRound() {
    board = emptyBoard();
    piecesPlaced = 0;
    cursorCol = 3;
    turnTimer = turnTime(level);
    phase = "esperando_jugador";
  }

  function resolveRound(outcome: "jugador" | "ia" | "empate") {
    if (outcome === "jugador") {
      const emptyCells = ROWS * COLS - piecesPlaced;
      score += 250 * level + 10 * emptyCells;
      level = Math.min(level + 1, MAX_LEVEL);
      roundsJugador++;
      resultText = "¡RONDA GANADA!";
      resultColor = YELLOW;
      resultTimer = RESULT_PAUSE;
      phase = "ronda_fin";
    } else if (outcome === "ia") {
      lives = Math.max(0, lives - 1);
      roundsIA++;
      if (lives <= 0) {
        gameOver = true;
        phase = "gameover";
        return;
      }
      resultText = "RONDA PERDIDA";
      resultColor = MAGENTA;
      resultTimer = RESULT_PAUSE;
      phase = "ronda_fin";
    } else {
      resultText = "TABLERO LLENO — EMPATE";
      resultColor = CYAN;
      resultTimer = RESULT_PAUSE;
      phase = "ronda_fin";
    }
  }

  function initGame() {
    board = emptyBoard();
    piecesPlaced = 0;
    phase = "esperando_jugador";
    cursorCol = 3;
    turnTimer = turnTime(1);
    iaTimer = 0;
    fallProgress = 0;
    resultTimer = 0;
    roundsJugador = 0;
    roundsIA = 0;
    score = 0;
    lives = LIVES_START;
    level = 1;
    gameOver = false;
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (phase !== "esperando_jugador") return;
    switch (e.code) {
      case "ArrowLeft":
        cursorCol = Math.max(0, cursorCol - 1);
        break;
      case "ArrowRight":
        cursorCol = Math.min(COLS - 1, cursorCol + 1);
        break;
      case "ArrowDown":
      case "Space":
        if (landingRow(cursorCol) !== -1) beginFall(1, cursorCol);
        break;
    }
  };
  window.addEventListener("keydown", onKeyDown);

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (phase === "gameover") return;

    if (phase === "esperando_jugador") {
      turnTimer -= dt;
      if (turnTimer <= 0) {
        const avail = availableColumns();
        beginFall(1, avail[0]);
      }
      return;
    }

    if (phase === "pensando_ia") {
      iaTimer -= dt;
      if (iaTimer <= 0) {
        beginFall(2, iaChooseColumn());
      }
      return;
    }

    if (phase === "cayendo") {
      fallProgress = Math.min(1, fallProgress + dt / FALL_DURATION);
      if (fallProgress >= 1) {
        board[fallRow][fallCol] = fallOwner;
        piecesPlaced++;
        const won = checkWinAt(fallRow, fallCol, fallOwner);
        if (won) {
          resolveRound(fallOwner === 1 ? "jugador" : "ia");
        } else if (piecesPlaced >= ROWS * COLS) {
          resolveRound("empate");
        } else if (fallOwner === 1) {
          phase = "pensando_ia";
          iaTimer = iaThinkTime(level);
        } else {
          phase = "esperando_jugador";
          turnTimer = turnTime(level);
        }
      }
      return;
    }

    if (phase === "ronda_fin") {
      resultTimer -= dt;
      if (resultTimer <= 0) startNewRound();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function cellCenter(r: number, c: number) {
    return {
      x: BOARD_X + c * CELL + CELL / 2,
      y: BOARD_Y + r * CELL + CELL / 2,
    };
  }

  function drawDisc(x: number, y: number, owner: 1 | 2, radius = CELL * 0.38) {
    const color = owner === 1 ? MAGENTA : CYAN;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBoard() {
    ctx.save();
    ctx.fillStyle = PANEL;
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = 16;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 0, 110, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.restore();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x, y } = cellCenter(r, c);
        const owner = board[r][c];
        if (owner === 0) {
          ctx.fillStyle = HOLE;
          ctx.beginPath();
          ctx.arc(x, y, CELL * 0.38, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawDisc(x, y, owner);
        }
      }
    }

    if (phase === "cayendo") {
      const { x, y: targetY } = cellCenter(fallRow, fallCol);
      const startY = BOARD_Y - CELL * 0.5;
      const eased = 1 - (1 - fallProgress) * (1 - fallProgress);
      const y = startY + (targetY - startY) * eased;
      drawDisc(x, y, fallOwner);
    }
  }

  function drawCursor() {
    if (phase !== "esperando_jugador") return;
    const bob = Math.sin(performance.now() / 220) * 4;
    const x = BOARD_X + cursorCol * CELL + CELL / 2;
    const y = BOARD_Y - 22 + bob;
    ctx.save();
    ctx.fillStyle = MAGENTA;
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 10);
    ctx.lineTo(x + 10, y - 10);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHud() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "bold 20px monospace";
    ctx.fillText("RAYA VELOZ", W / 2, 34);

    const barW = BOARD_W;
    const barX = BOARD_X;
    const barY = 96;
    const barH = 12;

    if (phase === "esperando_jugador" || phase === "cayendo") {
      ctx.font = "bold 13px monospace";
      ctx.fillStyle = MAGENTA;
      ctx.fillText("TU TURNO", W / 2, barY - 10);
      ctx.strokeStyle = "rgba(255,0,110,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      const frac = phase === "esperando_jugador" ? Math.max(0, turnTimer / turnTime(level)) : 0;
      ctx.fillStyle = MAGENTA;
      ctx.fillRect(barX, barY, barW * frac, barH);
    } else if (phase === "pensando_ia") {
      ctx.font = "bold 13px monospace";
      ctx.fillStyle = CYAN;
      ctx.fillText("IA PENSANDO...", W / 2, barY - 10);
      ctx.strokeStyle = "rgba(0,245,255,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      const frac = Math.max(0, iaTimer / iaThinkTime(level));
      ctx.fillStyle = CYAN;
      ctx.fillRect(barX, barY, barW * frac, barH);
    }

    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "rgba(230,233,255,0.7)";
    ctx.fillText(`RONDAS   TÚ ${roundsJugador}  ·  IA ${roundsIA}`, W / 2, BOARD_Y + BOARD_H + 34);
    ctx.restore();
  }

  function drawResultBanner() {
    if (phase !== "ronda_fin") return;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = resultColor;
    ctx.shadowColor = resultColor;
    ctx.shadowBlur = 18;
    ctx.font = "bold 30px monospace";
    ctx.fillText(resultText, W / 2, H / 2);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawBoard();
    drawCursor();
    drawHud();
    drawResultBanner();
  }

  function reportState() {
    callbacks.onUpdate({ score, lives, level, gameOver });
  }

  // ── Loop principal ───────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId = 0;

  function loop(ts: number) {
    if (paused) {
      lastTime = ts;
      draw();
      reportState();
      rafId = requestAnimationFrame(loop);
      return;
    }

    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    reportState();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null;
    },
    reset() {
      initGame();
    },
    forceGameOver() {
      gameOver = true;
      phase = "gameover";
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
