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
  height = H,
): void {
  const rand = rng(seed);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, W, height);
  for (let row = 0; row * th < height; row++) {
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

/*
 * Полы. Тайл — квадрат метр на метр, и повторяется он по обеим осям, поэтому
 * узор обязан быть периодичен и по ширине, и по высоте канваса.
 */

/**
 * Доски вдоль v, по одному стыку на колонку. Раз тайл повторяется вертикально,
 * доска с одним стыком и есть доска длиной ровно в метр — стыки же разнесены
 * по высоте, чтобы не сложиться в сетку.
 */
function planks(ctx: CanvasRenderingContext2D, base: [number, number, number], seed: number): void {
  const rand = rng(seed);
  const width = 32;
  for (let x = 0; x < W; x += width) {
    const tone = 0.85 + rand() * 0.3;
    ctx.fillStyle = `rgb(${base.map((c) => Math.round(c * tone)).join(',')})`;
    ctx.fillRect(x, 0, width, W);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `rgba(40,20,5,${0.08 + rand() * 0.1})`;
      const gx = x + 3 + rand() * (width - 6);
      const gy = rand() * W;
      const len = W * (0.3 + rand() * 0.5);
      ctx.fillRect(gx, gy, 1, len);
      ctx.fillRect(gx, gy - W, 1, len);
    }
    ctx.fillStyle = 'rgba(30,15,5,0.55)';
    ctx.fillRect(x, 0, 2, W);
    ctx.fillRect(x, Math.floor(rand() * W), width, 2);
  }
}

function oakFloor(ctx: CanvasRenderingContext2D): void {
  planks(ctx, [168, 118, 70], 20);
}

function darkFloor(ctx: CanvasRenderingContext2D): void {
  planks(ctx, [96, 62, 38], 21);
}

/** Паркет «корзинкой»: квадраты по четыре планки, направление чередуется. */
function parquet(ctx: CanvasRenderingContext2D): void {
  const rand = rng(22);
  const cell = 64;
  const strip = cell / 4;
  for (let row = 0; row < W / cell; row++) {
    for (let col = 0; col < W / cell; col++) {
      const x0 = col * cell;
      const y0 = row * cell;
      const across = (row + col) % 2 === 0;
      for (let k = 0; k < 4; k++) {
        const tone = 0.85 + rand() * 0.3;
        ctx.fillStyle = `rgb(${[140, 96, 58].map((c) => Math.round(c * tone)).join(',')})`;
        if (across) ctx.fillRect(x0, y0 + k * strip, cell, strip);
        else ctx.fillRect(x0 + k * strip, y0, strip, cell);
        ctx.fillStyle = 'rgba(30,15,5,0.45)';
        if (across) ctx.fillRect(x0, y0 + k * strip, cell, 1);
        else ctx.fillRect(x0 + k * strip, y0, 1, cell);
      }
    }
  }
  grain(ctx, 0, W, 0.04, 23);
}

function carpet(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#8a6f78';
  ctx.fillRect(0, 0, W, W);
  grain(ctx, 0, W, 0.07, 24);
  grain(ctx, 0, W, 0.05, 25);
}

/** Детский коврик-пазл: пастельные квадраты по полметра. */
function playMat(ctx: CanvasRenderingContext2D): void {
  // Цвета расставлены руками: случайный выбор на четырёх плитках легко даёт два цвета.
  const colors = [['#f3b8b0', '#a9d3ec'], ['#f6e28f', '#b3dfae']];
  const cell = W / 2;
  ctx.fillStyle = '#e9e2d4';
  ctx.fillRect(0, 0, W, W);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = colors[row]![col]!;
      ctx.fillRect(col * cell + 2, row * cell + 2, cell - 4, cell - 4);
    }
  }
  grain(ctx, 0, W, 0.03, 27);
}

/** Шахматка кухни: чёткое чередование, а не случайные цвета. */
function checker(ctx: CanvasRenderingContext2D): void {
  const cell = 64;
  for (let row = 0; row < W / cell; row++) {
    for (let col = 0; col < W / cell; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ece8df' : '#2f2e2c';
      ctx.fillRect(col * cell, row * cell, cell, cell);
    }
  }
  grain(ctx, 0, W, 0.04, 28);
}

function mosaic(ctx: CanvasRenderingContext2D): void {
  tiles(ctx, 32, 32, ['#e9eef0', '#dde5e8', '#f2f5f6'], '#9aa7ad', false, 29, W);
}

function greyTiles(ctx: CanvasRenderingContext2D): void {
  tiles(ctx, 64, 64, ['#8f9497', '#999ea1', '#868b8e'], '#5f6366', false, 30, W);
}

/** Бетон: неровная заливка, пятна и деформационный шов по краю каждого метра. */
function concrete(ctx: CanvasRenderingContext2D): void {
  const rand = rng(31);
  ctx.fillStyle = '#86827b';
  ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < 4; i++) {
    const cx = rand() * W;
    const cy = rand() * W;
    const r = 10 + rand() * 25;
    ctx.fillStyle = `rgba(40,35,30,${0.03 + rand() * 0.04})`;
    for (const dx of [-W, 0, W]) {
      for (const dy of [-W, 0, W]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  grain(ctx, 0, W, 0.08, 32);
  ctx.fillStyle = 'rgba(30,28,25,0.5)';
  ctx.fillRect(0, 0, W, 2);
  ctx.fillRect(0, 0, 2, W);
}

function linoleum(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#9c9484';
  ctx.fillRect(0, 0, W, W);
  grain(ctx, 0, W, 0.05, 33);
}

type Painter = (ctx: CanvasRenderingContext2D) => void;

/**
 * Тема комнаты → что нарисовать на её поверхностях. Потолок добавится сюда же,
 * не трогая JSON уровней.
 */
const THEMES: Record<RoomStyle, { wall: Painter; floor: Painter }> = {
  living: { wall: stripes, floor: oakFloor },
  bedroom: { wall: floral, floor: carpet },
  nursery: { wall: nursery, floor: playMat },
  hall: { wall: wainscot, floor: parquet },
  study: { wall: wood, floor: darkFloor },
  kitchen: { wall: tileKitchen, floor: checker },
  bath: { wall: tileBath, floor: mosaic },
  laundry: { wall: tileBath, floor: greyTiles },
  storage: { wall: brick, floor: concrete },
  plain: { wall: plaster, floor: linoleum },
};

/** Ключ — художник: стены и пол рисуют разные функции, так что кеш общий. */
const cache = new Map<Painter, THREE.MeshStandardMaterial>();

function painted(paint: Painter, height: number, wrapT: THREE.Wrapping): THREE.MeshStandardMaterial {
  const cached = cache.get(paint);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен.');
  paint(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = wrapT;
  texture.colorSpace = THREE.SRGBColorSpace;
  // Под скользящим углом вдоль длинного коридора мелкий узор без анизотропии
  // мылится или рябит. three сам урежет значение до предела видеокарты.
  texture.anisotropy = 8;

  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  cache.set(paint, material);
  return material;
}

/** Материал стен темы. Один на узор, общий для всех комнат с этим узором. */
export function wallMaterial(style: RoomStyle): THREE.MeshStandardMaterial {
  return painted(THEMES[style].wall, H, THREE.ClampToEdgeWrapping);
}

/** Материал пола темы. UV пола — мировые метры, тайл повторяется по обеим осям. */
export function floorMaterial(style: RoomStyle): THREE.MeshStandardMaterial {
  return painted(THEMES[style].floor, W, THREE.RepeatWrapping);
}
