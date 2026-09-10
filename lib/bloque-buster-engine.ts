import type { RealGameState } from "@/components/real-game-registry";

export type BloqueBusterEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type BloqueBusterEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const PADDLE_Y = 560;
const PADDLE_W = 81;
const PADDLE_H = 14;
const BALL_SIZE = 16;

const COLORS: Record<string, string> = {
  red: "#ff5252",
  yellow: "#ffd54f",
  cyan: "#4dd0e1",
  magenta: "#ff006e",
  hotpink: "#ff4da6",
  green: "#69f0ae",
  gray: "#9e9e9e",
};

type Block = { x: number; y: number; w: number; h: number; color: string; alive: boolean };
type LevelDef = { speed: number; blocks: { col: number; row: number; color: string }[] };

const LEVELS: LevelDef[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: { col: number; row: number; color: string }[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) l1.push({ col, row, color: rowColors1[row] });

  const l2: { col: number; row: number; color: string }[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: { col: number; row: number; color: string }[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: { col: number; row: number; color: string }[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  const l5: { col: number; row: number; color: string }[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

export function createBloqueBusterEngine(
  canvas: HTMLCanvasElement,
  callbacks: BloqueBusterEngineCallbacks,
): BloqueBusterEngineHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };

  let blocks: Block[] = [];
  let particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    color: string;
  }[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let gameOver = false;
  let paused = false;

  const keys: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    level = n;
    const def = LEVELS[n - 1];
    blocks = def.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    initBall();
  }

  function spawnBreak(x: number, y: number, color: string) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35,
        ttl: 0.35,
        color,
      });
    }
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function initGame() {
    initPaddle();
    score = 0;
    lives = 3;
    gameOver = false;
    particles = [];
    loadLevel(1);
  }

  function update(dt: number) {
    if (gameOver) return;

    if (keys["ArrowLeft"]) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys["ArrowRight"])
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        spawnBreak(block.x + block.w / 2, block.y + block.h / 2, COLORS[block.color]);
        score += 10;
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          if (level < 5) loadLevel(level + 1);
          else gameOver = true;
        }
        break;
      }
    }

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ttl -= dt;
    }
    particles = particles.filter((p) => p.ttl > 0);

    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameOver = true;
      } else {
        initBall();
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (const block of blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = COLORS[block.color];
      ctx.beginPath();
      ctx.roundRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, 4);
    }

    for (const p of particles) {
      const alpha = p.ttl / p.life;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(alpha, 0);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#e6e9ff";
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    ctx.fillStyle = "#00f5ff";
    ctx.beginPath();
    ctx.arc(ball.x + ball.w / 2, ball.y + ball.h / 2, ball.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function reportState() {
    callbacks.onUpdate({ score, lives, level, gameOver });
  }

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
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
