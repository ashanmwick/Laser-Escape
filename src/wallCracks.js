import * as THREE from "three";

// Procedurally-drawn crack overlays, generated once at module load so every
// wall's damage overlay can share the same 4 severity stages (only opacity
// and which stage is shown differ per wall — the crack pattern itself
// doesn't need to be unique per material).

const SIZE = 512;
const STAGE_CRACKS = [4, 9, 16, 26]; // line count per stage, light -> heavy
const STAGE_WIDTH = [1.5, 2, 2.75, 3.5];
const STAGE_ALPHA = [0.55, 0.7, 0.85, 1];

// Deterministic PRNG so the pattern is stable across reloads.
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawBranch(ctx, rand, x, y, angle, length, depth, width) {
  if (depth <= 0 || length < 4) return;
  const jitter = (rand() - 0.5) * 0.9;
  const a = angle + jitter;
  const x2 = x + Math.cos(a) * length;
  const y2 = y + Math.sin(a) * length;

  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (rand() < 0.6) {
    drawBranch(ctx, rand, x2, y2, a + (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.5), length * 0.55, depth - 1, width * 0.7);
  }
  drawBranch(ctx, rand, x2, y2, a, length * (0.55 + rand() * 0.2), depth - 1, width * 0.85);
}

function buildStageTexture(stageIndex) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = `rgba(10, 8, 6, ${STAGE_ALPHA[stageIndex]})`;
  ctx.lineCap = "round";

  const rand = mulberry32(1337 + stageIndex * 97);
  const count = STAGE_CRACKS[stageIndex];
  for (let i = 0; i < count; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const angle = rand() * Math.PI * 2;
    const length = SIZE * (0.08 + rand() * 0.1);
    drawBranch(ctx, rand, x, y, angle, length, 3, STAGE_WIDTH[stageIndex]);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let cached = null;
export function getCrackTextures() {
  if (!cached) {
    cached = [0, 1, 2, 3].map(buildStageTexture);
  }
  return cached;
}
