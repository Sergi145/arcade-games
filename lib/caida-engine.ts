import type { RealGameState } from "@/components/real-game-registry";

export type CaidaEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type CaidaEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

const W = 800;
const H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 24;

const PLAY_X = 110;
const PLAY_Y = 60;
const PLAY_W = COLS * BLOCK;
const PLAY_H = ROWS * BLOCK;

const SIDEBAR_X = PLAY_X + PLAY_W + 50;
const SIDEBAR_W = W - SIDEBAR_X - 40;

const CYAN = "#00f5ff";
const MAGENTA = "#ff006e";
const INK = "#e6e9ff";
const GRID_LINE = "rgba(0, 245, 255, 0.12)";

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - morado
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - naranja
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

type Shape = number[][];
type Piece = { type: number; shape: Shape; x: number; y: number };

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "KeyX",
]);

export function createCaidaEngine(
  canvas: HTMLCanvasElement,
  callbacks: CaidaEngineCallbacks,
): CaidaEngineHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  let board: number[][] = [];
  let current!: Piece;
  let next!: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let dropAccum = 0;
  let dropInterval = 1000;

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: Shape): Shape {
    const rows = shape.length;
    const cols = shape[0].length;
    const result: Shape = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) gameOver = true;
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    next = randomPiece();
    spawn();
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    context.globalAlpha = alpha;
    context.fillStyle = COLORS[colorIndex]!;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(PLAY_X + c * BLOCK, PLAY_Y);
      ctx.lineTo(PLAY_X + c * BLOCK, PLAY_Y + PLAY_H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(PLAY_X, PLAY_Y + r * BLOCK);
      ctx.lineTo(PLAY_X + PLAY_W, PLAY_Y + r * BLOCK);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayfieldFrame() {
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.strokeRect(PLAY_X - 1, PLAY_Y - 1, PLAY_W + 2, PLAY_H + 2);
  }

  function drawPlayfield() {
    ctx.save();
    ctx.translate(PLAY_X, PLAY_Y);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    if (!gameOver) {
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c]) drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c]) drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
    }
    ctx.restore();
  }

  function drawSidebar() {
    ctx.save();
    ctx.textBaseline = "top";

    ctx.font = "bold 14px monospace";
    ctx.fillStyle = MAGENTA;
    ctx.fillText("SIGUIENTE", SIDEBAR_X, PLAY_Y);

    const NEXT_BOX = 120;
    const nextBoxY = PLAY_Y + 30;
    ctx.strokeStyle = "rgba(255, 0, 110, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(SIDEBAR_X, nextBoxY, Math.min(NEXT_BOX, SIDEBAR_W), NEXT_BOX);

    const NB = 26;
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    ctx.save();
    ctx.translate(SIDEBAR_X + (NEXT_BOX - 4 * NB) / 2, nextBoxY + (NEXT_BOX - 4 * NB) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) drawBlock(ctx, offX + c, offY + r, shape[r][c], NB);
    ctx.restore();

    const linesY = nextBoxY + NEXT_BOX + 50;
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = CYAN;
    ctx.fillText("LÍNEAS", SIDEBAR_X, linesY);
    ctx.font = "bold 32px monospace";
    ctx.fillStyle = INK;
    ctx.fillText(String(lines), SIDEBAR_X, linesY + 26);

    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawPlayfieldFrame();
    drawGrid();
    drawPlayfield();
    drawSidebar();
  }

  function reportState() {
    callbacks.onUpdate({ score, lives: 0, level, gameOver });
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  };
  window.addEventListener("keydown", onKeyDown);

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

    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    if (!gameOver) {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) {
          current.y++;
        } else {
          lockPiece();
        }
      }
    }

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
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
