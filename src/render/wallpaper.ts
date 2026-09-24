import * as THREE from 'three';
import { ROOM } from '../config';
import type { RoomStyle } from '../core/types';

/**
 * Узоры стен рисуются кодом: файлов-текстур в проекте нет.
 *
 * Один тайл — полоса стены шириной 1 м и высотой во всю стену. Горизонтально он
 * повторяется, вертикально нет: так плинтус всегда внизу, а бордюр детской на
 * своей высоте. UV стен считаются в метрах (см. walls.ts), поэтому любой узор
 * обязан быть периодичен по ширине тайла — иначе на стыке метров шов.
 */
const PX_PER_M = 256;
const W = PX_PER_M;
const H = Math.round(ROOM.height * PX_PER_M);

/** Высота в метрах от пола → строка канваса (у канваса ось y смотрит вниз). */
function yAt(metres: number): number {
  return H - metres * PX_PER_M;
}

/** Детерминированный генератор: узор одинаков при каждой загрузке. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Мелкая неровность поверх заливки, чтобы стена не выглядела пластиком. */
function grain(ctx: CanvasRenderingContext2D, y0: number, y1: number, strength: number, seed: number): void {
  const rand = rng(seed);
  for (let i = 0; i < (W * (y1 - y0)) / 40; i++) {
    const light = rand() < 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${strength})` : `rgba(0,0,0,${strength})`;
    ctx.fillRect(Math.floor(rand() * W), y0 + Math.floor(rand() * (y1 - y0)), 2, 2);
  }
}

function baseboard(ctx: CanvasRenderingContext2D, color: string): void {
  const top = yAt(0.12);
  ctx.fillStyle = color;
  ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, top, W, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, top - 2, W, 2);
}

/** Рисует фигуру и её копии со сдвигом на ширину тайла, чтобы край не резал узор. */
function wrapped(x: number, draw: (x: number) => void): void {
  draw(x);
  draw(x - W);
  draw(x + W);
}

function stripes(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#e8dcc2';
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 64) {
    ctx.fillStyle = '#c99f8c';
    ctx.fillRect(x + 8, 0, 20, H);
    ctx.fillStyle = '#d8b9a4';
    ctx.fillRect(x + 34, 0, 4, H);
  }
  grain(ctx, 0, H, 0.04, 1);
  baseboard(ctx, '#f2ece0');
}

function floral(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#9fb0c4';
  ctx.fillRect(0, 0, W, H);
  const step = 64;
  for (let row = 0; row * step < H; row++) {
    for (let col = 0; col < W / step; col++) {
      const cx = col * step + (row % 2) * (step / 2);
      const cy = row * step + step / 2;
      wrapped(cx, (x) => {
        ctx.fillStyle = '#e9e3d6';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 6, cy + Math.sin(a) * 6, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#d3a84f';
        ctx.beginPath();
        ctx.arc(x, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  grain(ctx, 0, H, 0.04, 2);
  baseboard(ctx, '#ece6da');
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function nursery(ctx: CanvasRenderingContext2D): void {
  const border = yAt(1.0);
  // Верх — мятный в горошек и звёзды, низ — персиковый, между ними бордюр.
  ctx.fillStyle = '#bfe3d4';
  ctx.fillRect(0, 0, W, border);
  const step = 64;
  for (let row = 0; row * step < border; row++) {
    for (let col = 0; col < W / step; col++) {
      const cx = col * step + (row % 2) * (step / 2) + 16;
      const cy = row * step + 20;
      wrapped(cx, (x) => {
        if ((row + col) % 3 === 0) {
          ctx.fillStyle = '#f6e27a';
          star(ctx, x, cy, 10);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, cy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
  ctx.fillStyle = '#f3cdb8';
  ctx.fillRect(0, border, W, H - border);
  // Бордюр: полоса с пастельными флажками.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, border - 14, W, 28);
  const flags = ['#f39c9c', '#8fc4ea', '#f6e27a', '#a7dba0'];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = flags[i % flags.length]!;
    ctx.beginPath();
    ctx.moveTo(i * 32 + 4, border - 10);
    ctx.lineTo(i * 32 + 28, border - 10);
    ctx.lineTo(i * 32 + 16, border + 10);
    ctx.closePath();
    ctx.fill();
  }
  grain(ctx, 0, H, 0.03, 3);
  baseboard(ctx, '#ffffff');
}

function boards(ctx: CanvasRenderingContext2D, y0: number, y1: number, base: [number, number, number], seed: number): void {
  const rand = rng(seed);
  const width = 32;
  for (let x = 0; x < W; x += width) {
    const tone = 0.85 + rand() * 0.3;
    ctx.fillStyle = `rgb(${base.map((c) => Math.round(c * tone)).join(',')})`;
    ctx.fillRect(x, y0, width, y1 - y0);
    // Волокна: длинные тонкие вертикальные штрихи.
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `rgba(40,20,5,${0.08 + rand() * 0.1})`;
      const gx = x + 3 + rand() * (width - 6);
      const gy = y0 + rand() * (y1 - y0) * 0.5;
      ctx.fillRect(gx, gy, 1, (y1 - y0) * (0.3 + rand() * 0.5));
    }
    ctx.fillStyle = 'rgba(30,15,5,0.55)';
    ctx.fillRect(x, y0, 2, y1 - y0);
  }
}

function wood(ctx: CanvasRenderingContext2D): void {
  boards(ctx, 0, H, [130, 88, 52], 4);
  baseboard(ctx, '#4a2f1c');
}

function wainscot(ctx: CanvasRenderingContext2D): void {
  const rail = yAt(0.9);
  ctx.fillStyle = '#e6d9bd';
  ctx.fillRect(0, 0, W, rail);
  grain(ctx, 0, rail, 0.05, 5);
  boards(ctx, rail, H, [150, 104, 64], 6);
  // Поручень-молдинг поверх стыка краски и панели.
  ctx.fillStyle = '#6b4528';
  ctx.fillRect(0, rail - 8, W, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, rail - 8, W, 2);
  baseboard(ctx, '#5a3a22');
}

function tiles(
  ctx: CanvasRenderingContext2D,
  tw: number, th: number, colors: string[], grout: string, offset: boolean, seed: number,
): void {
  const rand = rng(seed);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, W, H);
  for (let row = 0; row * th < H; row++) {
    const shift = offset && row % 2 === 1 ? tw / 2 : 0;
    for (let col = 0; col < W / tw; col++) {
      const color = colors[Math.floor(rand() * colors.length)]!;
      wrapped(col * tw + shift, (x) => {
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, row * th + 1, tw - 2, th - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + 2, row * th + 2, tw - 4, 2);
      });
    }
  }
}

function tileKitchen(ctx: CanvasRenderingContext2D): void {
  // «Кабанчик» до полутора метров, выше — тёплая краска.
  tiles(ctx, 32, 16, ['#f4f1ea', '#eeeae0', '#f7f5ef'], '#b9b3a6', true, 7);
  const top = yAt(1.5);
  ctx.fillStyle = '#e9c98f';
  ctx.fillRect(0, 0, W, top);
  grain(ctx, 0, top, 0.05, 8);
  ctx.fillStyle = '#c9a063';
  ctx.fillRect(0, top - 3, W, 6);
}

function tileBath(ctx: CanvasRenderingContext2D): void {
  tiles(ctx, 32, 32, ['#9fcfe0', '#a9d6e5', '#93c5d8'], '#e8f0f2', false, 9);
}

function brick(ctx: CanvasRenderingContext2D): void {
  const rand = rng(10);
  ctx.fillStyle = '#b7afa3';
  ctx.fillRect(0, 0, W, H);
  const bw = 64;
  const bh = 20;
  for (let row = 0; row * bh < H; row++) {
    const shift = row % 2 === 1 ? bw / 2 : 0;
    for (let col = 0; col < W / bw; col++) {
      const tone = 200 + Math.floor(rand() * 30);
      const color = `rgb(${tone},${tone - 8},${tone - 20})`;
      wrapped(col * bw + shift, (x) => {
        ctx.fillStyle = color;
        ctx.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      });
    }
  }
  grain(ctx, 0, H, 0.06, 11);
  baseboard(ctx, '#6d665c');
}

function plaster(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#ddd5c6';
  ctx.fillRect(0, 0, W, H);
  grain(ctx, 0, H, 0.07, 12);
  baseboard(ctx, '#8a7a66');
}

type Painter = (ctx: CanvasRenderingContext2D) => void;

/**
 * Тема комнаты → что нарисовать на её поверхностях. Сейчас только стены; пол и
 * потолок добавятся сюда же, не трогая JSON уровней.
 */
const THEMES: Record<RoomStyle, { wall: Painter }> = {
  living: { wall: stripes },
  bedroom: { wall: floral },
  nursery: { wall: nursery },
  hall: { wall: wainscot },
  study: { wall: wood },
  kitchen: { wall: tileKitchen },
  bath: { wall: tileBath },
  laundry: { wall: tileBath },
  storage: { wall: brick },
  plain: { wall: plaster },
};

const cache = new Map<Painter, THREE.MeshStandardMaterial>();

/** Материал стен темы. Один на узор, общий для всех комнат с этим узором. */
export function wallMaterial(style: RoomStyle): THREE.MeshStandardMaterial {
  const paint = THEMES[style].wall;
  const cached = cache.get(paint);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен.');
  paint(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // Под скользящим углом вдоль длинного коридора мелкий узор без анизотропии
  // мылится или рябит. three сам урежет значение до предела видеокарты.
  texture.anisotropy = 8;

  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  cache.set(paint, material);
  return material;
}
