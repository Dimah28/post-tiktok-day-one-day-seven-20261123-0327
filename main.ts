// Koi Pond — a tiny agent-built game, day one vs day seven.
//
// The same pond, the same start, a week apart: day one has one koi and
// three pellets; day seven has five koi, lily pads, bubbles and a score.
// Both versions are rendered from this single file, from the same map and
// the same seeded pellet layout, so the video can cut between identical
// moments and the change is the whole story.
//
// Honest note: there is no week-old game here. Both builds were made in
// this one session; the "day seven" build is a richer version standing in
// for a week of daily updates, as the bounty brief asks the video to show.
//
// Usage:
//   node main.ts                                  copy VIDEO.json to /output
//   node main.ts --frame day1 3.5 out.png        render one 540x960 PNG frame
//   node main.ts --batch frames/                 render every frame the video needs
//
// Standard library only. Node 22.

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const W = 540;
const H = 960;

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32)
// ---------------------------------------------------------------------------
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Tiny PNG writer (RGB, no filter, zlib from node:zlib)
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (1 + width * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (A-Z, 0-9, a few marks)
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
};

// ---------------------------------------------------------------------------
// Drawing helpers on an RGB buffer
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

function setPx(buf: Uint8Array, x: number, y: number, c: RGB): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function blendPx(buf: Uint8Array, x: number, y: number, c: RGB, a: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = Math.round(buf[i] * (1 - a) + c[0] * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + c[1] * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + c[2] * a);
}

function fillCircle(buf: Uint8Array, cx: number, cy: number, r: number, c: RGB, alpha = 1): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        if (alpha >= 1) setPx(buf, x, y, c);
        else blendPx(buf, x, y, c, alpha);
      }
    }
  }
}

function ring(buf: Uint8Array, cx: number, cy: number, r: number, c: RGB, alpha = 1): void {
  for (let a = 0; a < Math.PI * 2; a += 0.03) {
    blendPx(buf, cx + Math.cos(a) * r, cy + Math.sin(a) * r, c, alpha);
    blendPx(buf, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), c, alpha);
  }
}

function fillEllipseRot(
  buf: Uint8Array,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ang: number,
  c: RGB,
): void {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  for (let y = Math.floor(cy - rx); y <= Math.ceil(cy + rx); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) setPx(buf, x, y, c);
    }
  }
}

function drawText(buf: Uint8Array, x: number, y: number, text: string, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "1") {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              setPx(buf, cx + col * scale + dx, y + row * scale + dy, c);
            }
          }
        }
      }
    }
    cx += 6 * scale;
  }
  return cx - x;
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

// ---------------------------------------------------------------------------
// The game: one pond, one scripted swim, seeded pellets
// ---------------------------------------------------------------------------
const POND = { cx: 270, cy: 540, rx: 225, ry: 335 };
const WATER_TOP: RGB = [16, 96, 110];
const WATER_BOT: RGB = [8, 52, 68];
const SAND: RGB = [214, 186, 130];
const WHITE: RGB = [255, 255, 255];

interface Pellet {
  x: number;
  y: number;
  eatAt: number; // seconds, Infinity if never eaten in 30 s
}

function playerPos(t: number): { x: number; y: number; ang: number } {
  const a = (2 * Math.PI * t) / 12;
  const x = POND.cx + 150 * Math.sin(a);
  const y = POND.cy + 185 * Math.sin(2 * a + 0.7);
  const dx = 150 * Math.cos(a) * ((2 * Math.PI) / 12);
  const dy = 185 * 2 * Math.cos(2 * a + 0.7) * ((2 * Math.PI) / 12);
  return { x, y, ang: Math.atan2(dy, dx) };
}

function buildPellets(): Pellet[] {
  const r = rng(7);
  const pellets: Pellet[] = [];
  while (pellets.length < 12) {
    const x = POND.cx + (r() * 2 - 1) * (POND.rx - 40);
    const y = POND.cy + (r() * 2 - 1) * (POND.ry - 40);
    const nx = (x - POND.cx) / POND.rx;
    const ny = (y - POND.cy) / POND.ry;
    if (nx * nx + ny * ny > 0.8) continue;
    pellets.push({ x, y, eatAt: Infinity });
  }
  // First pass of the player koi eats each pellet it swims over.
  for (const p of pellets) {
    for (let t = 0; t <= 30; t += 0.05) {
      const pos = playerPos(t);
      const d = Math.hypot(pos.x - p.x, pos.y - p.y);
      if (d < 26) {
        p.eatAt = t;
        break;
      }
    }
  }
  return pellets;
}

const PELLETS = buildPellets();

interface ExtraKoi {
  color: RGB;
  belly: RGB;
  rx: number;
  ry: number;
  period: number;
  phase: number;
  size: number;
}

const EXTRA_KOI: ExtraKoi[] = [
  { color: [240, 240, 235], belly: [255, 255, 255], rx: 120, ry: 150, period: 9, phase: 1.3, size: 0.8 },
  { color: [30, 30, 34], belly: [70, 70, 78], rx: 170, ry: 120, period: 14, phase: 2.6, size: 0.9 },
  { color: [255, 214, 64], belly: [255, 240, 180], rx: 100, ry: 210, period: 11, phase: 4.1, size: 0.75 },
  { color: [214, 69, 65], belly: [255, 200, 190], rx: 185, ry: 165, period: 16, phase: 0.4, size: 0.85 },
];

const LILIES = (() => {
  const r = rng(21);
  const out: { x: number; y: number; r: number; ph: number }[] = [];
  for (let i = 0; i < 5; i++) {
    out.push({
      x: 90 + r() * 360,
      y: 260 + r() * 560,
      r: 24 + r() * 12,
      ph: r() * Math.PI * 2,
    });
  }
  return out;
})();

const BUBBLES = (() => {
  const r = rng(99);
  const out: { x: number; speed: number; r: number; off: number }[] = [];
  for (let i = 0; i < 14; i++) {
    out.push({ x: 70 + r() * 400, speed: 26 + r() * 30, r: 3 + r() * 5, off: r() * 800 });
  }
  return out;
})();

const STONES = (() => {
  const r = rng(5);
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r() * 0.15;
    out.push({
      x: POND.cx + Math.cos(a) * (POND.rx + 2),
      y: POND.cy + Math.sin(a) * (POND.ry + 2),
      r: 5 + r() * 5,
    });
  }
  return out;
})();

function drawKoi(
  buf: Uint8Array,
  x: number,
  y: number,
  ang: number,
  size: number,
  body: RGB,
  belly: RGB,
  t: number,
): void {
  const wig = Math.sin(t * 6) * 0.25;
  const a = ang + wig * 0.3;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // Tail: two triangles fanning behind the body.
  const tx = x - cos * 24 * size;
  const ty = y - sin * 24 * size;
  const px = -sin;
  const py = cos;
  const flap = Math.sin(t * 6) * 8 * size;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    const tipX = tx - cos * 16 * size + px * s * (10 * size + flap * s * 0.4);
    const tipY = ty - sin * 16 * size + py * s * (10 * size + flap * s * 0.4);
    for (let s2 = 0; s2 <= 1; s2 += 0.05) {
      for (let s3 = 0; s3 <= 1 - s2; s3 += 0.05) {
        const bx = tx + (tipX - tx) * s2 + px * s * 8 * size * s3;
        const by = ty + (tipY - ty) * s2 + py * s * 8 * size * s3;
        setPx(buf, bx, by, body);
      }
    }
  }
  fillEllipseRot(buf, x, y, 26 * size, 12 * size, a, body);
  fillEllipseRot(buf, x + cos * 4 * size, y + sin * 4 * size, 18 * size, 8 * size, a, belly);
  // Eye.
  const ex = x + cos * 16 * size - sin * 5 * size;
  const ey = y + sin * 16 * size + cos * 5 * size;
  fillCircle(buf, ex, ey, 2.5 * size, [20, 20, 20]);
}

function renderFrame(day: "day1" | "day7", t: number): Buffer {
  const buf = new Uint8Array(W * H * 3);
  // Water gradient.
  for (let y = 0; y < H; y++) {
    const f = y / H;
    const r = Math.round(WATER_TOP[0] * (1 - f) + WATER_BOT[0] * f);
    const g = Math.round(WATER_TOP[1] * (1 - f) + WATER_BOT[1] * f);
    const b = Math.round(WATER_TOP[2] * (1 - f) + WATER_BOT[2] * f);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
    }
  }
  // Sandy pond floor glow in the middle.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x - POND.cx) / POND.rx;
      const ny = (y - POND.cy) / POND.ry;
      const d = nx * nx + ny * ny;
      if (d < 1) {
        const i = (y * W + x) * 3;
        const a = 0.16 * (1 - d);
        buf[i] = Math.round(buf[i] * (1 - a) + SAND[0] * a);
        buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + SAND[1] * a);
        buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + SAND[2] * a);
      }
    }
  }
  // Stones around the pond edge.
  for (const s of STONES) fillCircle(buf, s.x, s.y, s.r, [74, 96, 100]);

  const pelletCount = day === "day1" ? 3 : 12;
  const eaten = PELLETS.slice(0, pelletCount).filter((p) => p.eatAt <= t).length;

  // Lily pads (day seven only).
  if (day === "day7") {
    for (const l of LILIES) {
      const bob = Math.sin(t * 0.8 + l.ph) * 2;
      fillCircle(buf, l.x, l.y + bob, l.r, [34, 122, 62]);
      fillCircle(buf, l.x, l.y + bob, l.r * 0.55, [46, 148, 78]);
    }
    // Bubbles rising.
    for (const b of BUBBLES) {
      const by = 900 - ((b.off + b.speed * t) % 800);
      ring(buf, b.x, by, b.r, [200, 235, 240], 0.55);
    }
  }

  // Pellets not yet eaten.
  for (let i = 0; i < pelletCount; i++) {
    const p = PELLETS[i];
    if (p.eatAt > t) {
      fillCircle(buf, p.x, p.y, 6, [255, 196, 66]);
      fillCircle(buf, p.x - 2, p.y - 2, 2, [255, 230, 150]);
    } else if (t - p.eatAt < 0.6) {
      // Ripple where a pellet was just eaten.
      ring(buf, p.x, p.y, 8 + (t - p.eatAt) * 40, [255, 255, 255], 0.7 * (1 - (t - p.eatAt) / 0.6));
    }
  }

  // Extra koi (day seven only), swimming their own loops.
  if (day === "day7") {
    for (const k of EXTRA_KOI) {
      const a = (2 * Math.PI * t) / k.period + k.phase;
      const x = POND.cx + k.rx * Math.sin(a);
      const y = POND.cy + k.ry * Math.sin(2 * a + 0.9);
      const dx = k.rx * Math.cos(a) * ((2 * Math.PI) / k.period);
      const dy = k.ry * 2 * Math.cos(2 * a + 0.9) * ((2 * Math.PI) / k.period);
      drawKoi(buf, x, y, Math.atan2(dy, dx), k.size, k.color, k.belly, t + k.phase);
    }
  }

  // The player koi: same path, same start, both days.
  const pos = playerPos(t);
  drawKoi(buf, pos.x, pos.y, pos.ang, 1, [255, 140, 66], [255, 220, 180], t);

  // HUD: title, day, score.
  drawText(buf, 18, 22, "KOI POND", 3, WHITE);
  const dayLabel = day === "day1" ? "DAY 1" : "DAY 7";
  drawText(buf, W - 18 - textWidth(dayLabel, 3), 22, dayLabel, 3, WHITE);
  drawText(buf, 18, 58, `SCORE ${String(eaten).padStart(2, "0")}`, 2, [255, 220, 150]);
  const hint =
    day === "day1" ? "EAT THE PELLETS" : "5 KOI - LILIES - BUBBLES";
  drawText(buf, Math.round((W - textWidth(hint, 2)) / 2), H - 44, hint, 2, [190, 225, 230]);

  return encodePng(W, H, buf);
}

// ---------------------------------------------------------------------------
// Entry point: no args copies VIDEO.json to the output dir (grader behaviour)
// ---------------------------------------------------------------------------
function copyVideoJson(): void {
  // The grader mounts the repository at /bot; locally MAKEFUN_BOT_DIR
  // points at it. Fall back to this file's own directory (the repo root).
  const botDir = process.env.MAKEFUN_BOT_DIR ?? ROOT;
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  copyFileSync(join(botDir, "VIDEO.json"), join(outDir, "VIDEO.json"));
  console.log(`copied VIDEO.json to ${outDir}`);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args[0] === "--frame") {
    const day = args[1] === "day7" ? "day7" : "day1";
    const t = Number(args[2] ?? "0");
    const out = args[3] ?? `${day}-${t}.png`;
    writeFileSync(out, renderFrame(day, t));
    console.log(`wrote ${out} (${day} t=${t})`);
    return;
  }
  if (args[0] === "--batch") {
    const dir = args[1] ?? "frames";
    mkdirSync(dir, { recursive: true });
    const fps = 12;
    for (let i = 0; i <= 12 * fps; i++) {
      const name = join(dir, `d1_${String(i).padStart(4, "0")}.png`);
      writeFileSync(name, renderFrame("day1", i / fps));
    }
    for (let i = 0; i <= 15 * fps; i++) {
      const name = join(dir, `d7_${String(i).padStart(4, "0")}.png`);
      writeFileSync(name, renderFrame("day7", i / fps));
    }
    console.log(`rendered frames to ${dir}`);
    return;
  }
  copyVideoJson();
}

main();
