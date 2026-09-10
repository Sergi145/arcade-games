import type { RealGameState } from "@/components/real-game-registry";

export type SerpentinaEngineState = RealGameState;

export type SerpentinaEngineCallbacks = {
  onUpdate: (state: SerpentinaEngineState) => void;
};

export type SerpentinaEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

const W = 800;
const H = 600;
const CELL = 20;
const COLS = W / CELL; // 40
const ROWS = H / CELL; // 30

const INITIAL_SPEED = 8; // celdas/segundo
const SPEED_PER_LEVEL = 0.75;
const FRUITS_PER_LEVEL = 5;
const POINTS_PER_FRUIT = 10;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// Atlas de frutas portado de references/source-assets/snake-assets/sprites.js
// Hoja fruits.png: 3790x442px, fondo transparente. Fila usada: y=136-295.
const FRUIT_ATLAS: { x: number; y: number; w: number; h: number }[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
];

type Cell = { x: number; y: number };

const DIR_UP: Cell = { x: 0, y: -1 };
const DIR_DOWN: Cell = { x: 0, y: 1 };
const DIR_LEFT: Cell = { x: -1, y: 0 };
const DIR_RIGHT: Cell = { x: 1, y: 0 };

const KEY_DIR: Record<string, Cell> = {
  ArrowUp: DIR_UP,
  ArrowDown: DIR_DOWN,
  ArrowLeft: DIR_LEFT,
  ArrowRight: DIR_RIGHT,
};

export function createSerpentinaEngine(
  canvas: HTMLCanvasElement,
  callbacks: SerpentinaEngineCallbacks,
): SerpentinaEngineHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Asset de frutas ──────────────────────────────────────────────────────
  const fruitImg = new Image();
  let fruitImgLoaded = false;
  fruitImg.onload = () => {
    fruitImgLoaded = true;
  };
  fruitImg.src = "/snake-assets/fruits.png";

  // ── Input ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    const nd = KEY_DIR[e.code];
    if (!nd) return;
    e.preventDefault();
    if (!(nd.x === -dir.x && nd.y === -dir.y)) {
      queuedDir = nd;
    }
  };
  window.addEventListener("keydown", onKeyDown);

  // ── Estado ────────────────────────────────────────────────────────────────
  let snake: Cell[] = [];
  let dir: Cell = DIR_RIGHT;
  let queuedDir: Cell = DIR_RIGHT;
  let fruit: { x: number; y: number; spriteIndex: number } = {
    x: 0,
    y: 0,
    spriteIndex: 0,
  };
  let score = 0;
  let level = 1;
  let speed = INITIAL_SPEED;
  let fruitsEaten = 0;
  let gameOver = false;
  let paused = false;
  let stepAccum = 0;

  function spawnFruit() {
    let cell: Cell;
    do {
      cell = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
    } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
    fruit = {
      x: cell.x,
      y: cell.y,
      spriteIndex: randInt(0, FRUIT_ATLAS.length - 1),
    };
  }

  function initGame() {
    const startY = Math.floor(ROWS / 2);
    const startX = Math.floor(COLS / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    dir = DIR_RIGHT;
    queuedDir = DIR_RIGHT;
    score = 0;
    level = 1;
    speed = INITIAL_SPEED;
    fruitsEaten = 0;
    gameOver = false;
    stepAccum = 0;
    spawnFruit();
  }

  function step() {
    dir = queuedDir;
    const head = snake[0];
    const newHead: Cell = { x: head.x + dir.x, y: head.y + dir.y };

    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      gameOver = true;
      return;
    }

    const eating = newHead.x === fruit.x && newHead.y === fruit.y;
    const bodyToCheck = eating ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      gameOver = true;
      return;
    }

    snake.unshift(newHead);
    if (eating) {
      score += POINTS_PER_FRUIT;
      fruitsEaten++;
      if (fruitsEaten % FRUITS_PER_LEVEL === 0) {
        level++;
        speed += SPEED_PER_LEVEL;
      }
      spawnFruit();
    } else {
      snake.pop();
    }
  }

  function update(dt: number) {
    if (gameOver) return;
    stepAccum += dt;
    const stepInterval = 1 / speed;
    while (stepAccum >= stepInterval && !gameOver) {
      stepAccum -= stepInterval;
      step();
    }
  }

  function drawFruit() {
    const cx = fruit.x * CELL + CELL / 2;
    const cy = fruit.y * CELL + CELL / 2;
    if (fruitImgLoaded) {
      const sprite = FRUIT_ATLAS[fruit.spriteIndex];
      const targetH = CELL * 1.3;
      const targetW = (sprite.w / sprite.h) * targetH;
      ctx.drawImage(
        fruitImg,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        cx - targetW / 2,
        cy - targetH / 2,
        targetW,
        targetH,
      );
    } else {
      ctx.fillStyle = "#ff5a7a";
      ctx.fillRect(fruit.x * CELL + 3, fruit.y * CELL + 3, CELL - 6, CELL - 6);
    }
  }

  function draw() {
    ctx.fillStyle = "#04160f";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(0,255,150,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    drawFruit();

    snake.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? "#7CFC9A" : "#2ecc71";
      const pad = 1.5;
      const r = 4;
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;
      const w = CELL - pad * 2;
      const h = CELL - pad * 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();

      if (isHead) {
        ctx.fillStyle = "#04160f";
        const eyeSize = 2.5;
        const ex1 = x + w * 0.28;
        const ex2 = x + w * 0.72;
        const ey = y + h * 0.32;
        ctx.beginPath();
        ctx.arc(ex1, ey, eyeSize, 0, Math.PI * 2);
        ctx.arc(ex2, ey, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function reportState() {
    callbacks.onUpdate({ score, lives: 0, level, gameOver });
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
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
