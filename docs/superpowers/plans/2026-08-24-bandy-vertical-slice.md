# Bandy Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать играбельный от старта до победы вертикальный срез 3D-игры от первого лица: игрок ходит по четырём помещениям, подбирает ключ, открывает им замок на двери, находит дверь EXIT и выходит по коридору к белому свету.

**Architecture:** Два слоя с жёсткой границей. `src/core/` — чистый TypeScript без единого импорта three.js: типы и валидация уровня, состояние мира, инвентарь, реестр взаимодействий, коллайдеры, разрешение движения; всё покрыто Vitest и запускается без браузера. `src/render/`, `src/input/`, `src/ui/` — three.js и DOM: строят сцену из данных, читают состояние ядра, шлют в него команды, подписываются на события. Ввод спрятан за единым интерфейсом, поэтому десктоп и телефон — две реализации, а не два проекта.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, GitHub Pages, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-24-bandy-design.md`

## Global Constraints

Требования ниже действуют во всех задачах без исключения.

- **`src/core/` не импортирует three.js.** Ни прямо, ни транзитивно. Нарушение этого правила ломает всю тестируемость проекта.
- **`vite.config.ts` обязан содержать `base: '/bandy/'`.** Сайт живёт в подпапке `https://navoznov.github.io/bandy/`, без этого на Pages будет белый экран и 404 на все ресурсы.
- **Хоткеи читаются только через `event.code`**, никогда через `event.key`. Физическая `KeyI` в русской раскладке даёт «Ш», а русская «И» лежит на физической `KeyB`. Инвентарь открывается по `KeyI` и `Tab`.
- **Файлов-текстур в проекте нет.** Всё процедурно: canvas-текстуры генерируются в рантайме.
- **Тени выключены** (`renderer.shadowMap.enabled = false`). Это первое, что съедает fps на мобильных GPU.
- **`deltaTime` всегда клампится потолком 0.05 с.** Без этого после сворачивания вкладки игрок телепортируется сквозь стены.
- **`renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.** На телефоне DPR равен 3, рендер в три раза убивает кадр.
- **Канвас получает `touch-action: none`**, тач-обработчики вызывают `preventDefault()`. Иначе браузер примет свайп за скролл, а два пальца за зум.
- **Каждый активный палец отслеживается по `pointerId`.** Без этого второй палец перехватит события первого и управление залипнет.
- **В CSS используется `100dvh`, не `100vh`.** На мобильных `100vh` врёт из-за адресной строки.
- **Единицы — метры.** Игрок: глаза на 1.6, радиус 0.3, скорость 3 м/с. Комнаты высотой 3.0, стены 0.2, проём 0.9 × 2.1.
- **Nothing requiring `SharedArrayBuffer`.** GitHub Pages не отдаёт заголовки `COOP`/`COEP`.
- **Node 20.19 или новее** — требование Vite 7.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `index.html` | Разметка: канвас, DOM-оверлеи HUD, инвентаря, засветки, ошибок |
| `src/config.ts` | Все числовые константы игры в одном месте |
| `src/main.ts` | Сборка приложения и игровой цикл |
| `src/core/types.ts` | Типы уровня, эффектов, состояния мира |
| `src/core/validate.ts` | JSON → `Level` либо список внятных ошибок |
| `src/core/colliders.ts` | `Level` → список AABB |
| `src/core/collision.ts` | Разрешение движения круга среди AABB |
| `src/core/inventory.ts` | Запросы и команды над расположением предметов |
| `src/core/world.ts` | Состояние мира, применение эффектов, события |
| `src/core/interactions.ts` | Разрешение взаимодействий, `describe` и `apply` |
| `src/render/materials.ts` | Процедурные текстуры и материалы комнат |
| `src/render/walls.ts` | Построение стен с дверными проёмами |
| `src/render/scene.ts` | `Level` → сцена three.js |
| `src/render/doors.ts` | Анимация створок и меши замков |
| `src/render/hand.ts` | Предмет в руках, вторая камера |
| `src/render/sign.ts` | Табличка EXIT из canvas-текстуры |
| `src/input/index.ts` | `InputState` и выбор активной схемы |
| `src/input/desktop.ts` | Pointer Lock, мышь, WASD |
| `src/input/touch.ts` | Плавающий стик, свайп, экранные кнопки |
| `src/ui/hud.ts` | Прицел, строка подсказки, оверлей засветки |
| `src/ui/inventory.ts` | DOM-оверлей инвентаря |
| `src/ui/fatal.ts` | Экран ошибок валидации, WebGL и исключений |
| `src/levels/items.json` | Определения предметов, общие для всех уровней |
| `src/levels/level_01.json` | Карта вертикального среза |
| `.github/workflows/deploy.yml` | Тесты, сборка, публикация на Pages |

---

### Task 1: Каркас проекта и работающий инструментарий

Задача заканчивается тем, что `npm test` зелёный, `npm run dev` открывает страницу, а `npm run build` кладёт в `dist/` сборку с правильными путями.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/config.ts`
- Test: `src/config.test.ts`

**Interfaces:**
- Consumes: ничего, это первая задача
- Produces: константы `PLAYER` (`{ eyeHeight: 1.6, radius: 0.3, speed: 3 }`), `ROOM` (`{ height: 3, wallThickness: 0.2 }`), `DOOR` (`{ width: 0.9, height: 2.1, openSeconds: 0.4 }`), `LOOK` (`{ sensitivity: 0.0022, maxPitch: 1.4835 }`), `MAX_DELTA_SECONDS = 0.05`, `INTERACT_RANGE = 2.5`

- [ ] **Step 1: Инициализировать пакет и поставить зависимости**

```bash
npm init -y
npm i three
npm i -D typescript vite vitest @types/three
```

Версии не пинуем вручную — пусть npm возьмёт актуальные. Требование только к Node: 20.19 или новее, проверить через `node -v`.

- [ ] **Step 2: Прописать скрипты в `package.json`**

Заменить блок `"scripts"` целиком и добавить `"type": "module"`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit && vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Создать `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`noUncheckedIndexedAccess` включён намеренно: он заставит проверять результат обращения по индексу, а в коде коллизий и разбора уровня это ровно то место, где легче всего словить `undefined`.

- [ ] **Step 4: Создать `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bandy/',
  build: { target: 'es2022' },
});
```

`base` критичен: сайт живёт в подпапке репозитория.

`npm test` намеренно начинается с `tsc --noEmit`. `vite build` типы не проверяет — он
их просто срезает, — поэтому без этого шага `strict` и `noUncheckedIndexedAccess` из
`tsconfig.json` не поймали бы ничего нигде, кроме редактора. Опечатка в идентификаторе
предмета — ровно то, ради чего в проекте вообще взят TypeScript.

- [ ] **Step 5: Создать `index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>Bandy</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100dvh; overflow: hidden; background: #000; }
      #canvas { display: block; width: 100%; height: 100dvh; touch-action: none; }
    </style>
  </head>
  <body>
    <canvas id="canvas"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Создать `.gitignore`**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 7: Написать падающий тест на константы**

Создать `src/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PLAYER, DOOR, MAX_DELTA_SECONDS } from './config';

describe('config', () => {
  it('задаёт человеческие размеры игрока', () => {
    expect(PLAYER.eyeHeight).toBe(1.6);
    expect(PLAYER.radius).toBe(0.3);
  });

  it('дверной проём выше игрока', () => {
    expect(DOOR.height).toBeGreaterThan(PLAYER.eyeHeight);
  });

  it('клампит шаг времени, чтобы игрок не проскакивал стены после сворачивания вкладки', () => {
    expect(MAX_DELTA_SECONDS).toBeLessThanOrEqual(0.05);
  });
});
```

- [ ] **Step 8: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./config"`.

- [ ] **Step 9: Создать `src/config.ts`**

```ts
export const PLAYER = {
  eyeHeight: 1.6,
  radius: 0.3,
  speed: 3,
} as const;

export const ROOM = {
  height: 3,
  wallThickness: 0.2,
} as const;

export const DOOR = {
  width: 0.9,
  height: 2.1,
  openSeconds: 0.4,
} as const;

export const LOOK = {
  sensitivity: 0.0022,
  maxPitch: 1.4835, // 85 градусов в радианах
} as const;

/** Потолок шага времени. Без него вкладка из фона телепортирует игрока сквозь стены. */
export const MAX_DELTA_SECONDS = 0.05;

/** Дальность луча прицела в метрах. */
export const INTERACT_RANGE = 2.5;
```

- [ ] **Step 10: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS, 3 теста.

- [ ] **Step 11: Проверить dev-сервер и сборку**

Run: `npm run dev` — открыть выданный адрес, увидеть чёрную страницу без ошибок в консоли, остановить сервер.
Run: `npm run build` — убедиться, что в `dist/index.html` пути к ассетам начинаются с `/bandy/`.

- [ ] **Step 12: Коммит**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src/config.ts src/config.test.ts
git commit -m "Add project scaffolding with Vite, TypeScript and Vitest"
```

---

### Task 2: Типы уровня и валидация

Валидатор — основной инструмент отладки карт, поэтому он делается раньше рендера.

**Files:**
- Create: `src/core/types.ts`, `src/core/validate.ts`
- Test: `src/core/validate.test.ts`

**Interfaces:**
- Consumes: ничего из предыдущих задач
- Produces:
  - типы `Rect = readonly [x: number, z: number, w: number, d: number]`, `RoomDef`, `DoorDef`, `ItemPlacement`, `TriggerDef`, `ItemDef`, `ItemLocation`, `InteractionRule`, `Level`
  - `Effect` — размеченное объединение из семи вариантов: `take`, `consume`, `destroy`, `toggleDoor`, `setFlag`, `say`, `win`
  - `validateLevel(raw: unknown, itemDefs: Record<string, ItemDef>): { ok: true; level: Level } | { ok: false; errors: string[] }`
  - `roomBounds(room: RoomDef): { x0: number; x1: number; z0: number; z1: number }`

- [ ] **Step 1: Написать падающие тесты валидации**

Создать `src/core/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateLevel } from './validate';
import type { ItemDef } from './types';

const itemDefs: Record<string, ItemDef> = {
  key_brass: { id: 'key_brass', name: 'Латунный ключ', holdable: true },
};

function baseLevel() {
  return {
    id: 'test',
    spawn: { room: 'a', x: 2, z: 2, yaw: 0 },
    rooms: [
      { id: 'a', rect: [0, 0, 8, 6], color: '#8b8b8f', light: 0.9 },
      { id: 'b', rect: [8, 2, 6, 2], color: '#6f6f74', light: 0.6 },
    ],
    doors: [{ id: 'd_ab', between: ['a', 'b'], at: [8, 3] }],
    items: [{ def: 'key_brass', room: 'a', at: [2, 0.9, 4] }],
    triggers: [],
    interactions: [],
  };
}

function errorsFor(mutate: (lvl: ReturnType<typeof baseLevel>) => void): string[] {
  const lvl = baseLevel();
  mutate(lvl);
  const result = validateLevel(lvl, itemDefs);
  return result.ok ? [] : result.errors;
}

describe('validateLevel', () => {
  it('принимает корректный уровень', () => {
    const result = validateLevel(baseLevel(), itemDefs);
    expect(result.ok).toBe(true);
  });

  it('ловит дверь, ссылающуюся на несуществующую комнату', () => {
    const errors = errorsFor((l) => { l.doors[0]!.between = ['a', 'nope']; });
    expect(errors.join(' ')).toContain('nope');
  });

  it('ловит дверь не на общей стене', () => {
    const errors = errorsFor((l) => { l.doors[0]!.at = [3, 3]; });
    expect(errors.join(' ')).toContain('общей стене');
  });

  it('ловит дверь на дальней стене комнаты, которой сосед не касается', () => {
    const errors = errorsFor((l) => { l.doors[0]!.at = [0, 3]; });
    expect(errors.join(' ')).toContain('общей стене');
  });

  it('принимает дверь на горизонтальной общей стене', () => {
    const lvl = baseLevel();
    lvl.rooms.push({ id: 'c', rect: [0, 6, 4, 4], color: '#888', light: 1 });
    lvl.doors.push({ id: 'd_ac', between: ['a', 'c'], at: [2, 6] });
    expect(validateLevel(lvl, itemDefs).ok).toBe(true);
  });

  it('ловит пересечение комнат', () => {
    const errors = errorsFor((l) => { l.rooms[1]!.rect = [4, 2, 6, 2]; });
    expect(errors.join(' ')).toContain('пересекаются');
  });

  it('ловит предмет вне своей комнаты', () => {
    const errors = errorsFor((l) => { l.items[0]!.at = [50, 0.9, 50]; });
    expect(errors.join(' ')).toContain('key_brass');
  });

  it('ловит ссылку на неизвестное определение предмета', () => {
    const errors = errorsFor((l) => { l.items[0]!.def = 'ghost'; });
    expect(errors.join(' ')).toContain('ghost');
  });

  it('ловит два предмета с одним определением', () => {
    const errors = errorsFor((l) => {
      l.items.push({ def: 'key_brass', room: 'a', at: [3, 0.9, 4] });
    });
    expect(errors.join(' ')).toContain('дважды');
  });

  it('ловит замок, который нечем открыть', () => {
    const errors = errorsFor((l) => { (l.doors[0] as Record<string, unknown>).lock = 'lock_x'; });
    expect(errors.join(' ')).toContain('lock_x');
  });

  it('ловит спавн вне своей комнаты', () => {
    const errors = errorsFor((l) => { l.spawn.x = 99; });
    expect(errors.join(' ')).toContain('появления');
  });

  it('ловит триггер вне своей комнаты', () => {
    const errors = errorsFor((l) => {
      l.triggers.push({ id: 'win', room: 'a', rect: [50, 50, 2, 2], effect: 'win' });
    });
    expect(errors.join(' ')).toContain('win');
  });

  it('разбирает сокращённую запись эффектов в размеченное объединение', () => {
    const lvl = baseLevel();
    (lvl.doors[0] as Record<string, unknown>).lock = 'lock_x';
    lvl.interactions.push({
      use: 'key_brass',
      on: 'lock_x',
      effects: [{ destroy: 'lock_x' }, { consume: 'key_brass' }, { say: 'Щёлк.' }],
    } as never);
    const result = validateLevel(lvl, itemDefs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.level.interactions[0]!.effects).toEqual([
      { kind: 'destroy', object: 'lock_x' },
      { kind: 'consume', item: 'key_brass' },
      { kind: 'say', text: 'Щёлк.' },
    ]);
  });
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `npm test src/core/validate.test.ts`
Expected: FAIL — `Failed to resolve import "./validate"`.

- [ ] **Step 3: Создать `src/core/types.ts`**

```ts
export type Rect = readonly [x: number, z: number, w: number, d: number];

export interface ItemDef {
  id: string;
  name: string;
  /** Можно ли взять предмет в руки из инвентаря. */
  holdable: boolean;
}

export interface RoomDef {
  id: string;
  rect: Rect;
  color: string;
  /** Яркость освещения комнаты, 0..1. Позже станет множителем для полумрака. */
  light: number;
}

export interface DoorDef {
  id: string;
  between: readonly [string, string];
  at: readonly [number, number];
  /** Идентификатор замка. Дверь заперта, пока объект замка существует. */
  lock?: string;
  /** Текст таблички над дверью. */
  sign?: string;
}

export interface ItemPlacement {
  def: string;
  room: string;
  at: readonly [number, number, number];
}

export interface TriggerDef {
  id: string;
  room: string;
  rect: Rect;
  effect: 'win';
}

export type Effect =
  | { kind: 'take'; item: string }
  | { kind: 'consume'; item: string }
  | { kind: 'destroy'; object: string }
  | { kind: 'setFlag'; flag: string }
  | { kind: 'toggleDoor'; door: string }
  | { kind: 'say'; text: string }
  | { kind: 'win' };

export interface InteractionRule {
  use: string;
  on: string;
  effects: Effect[];
}

export interface Spawn {
  room: string;
  x: number;
  z: number;
  yaw: number;
}

export interface Level {
  id: string;
  spawn: Spawn;
  rooms: RoomDef[];
  doors: DoorDef[];
  items: ItemPlacement[];
  triggers: TriggerDef[];
  interactions: InteractionRule[];
  itemDefs: Record<string, ItemDef>;
}

export type ItemLocation =
  | { kind: 'world'; room: string; at: readonly [number, number, number] }
  | { kind: 'inventory' }
  | { kind: 'hand' }
  | { kind: 'gone' };
```

- [ ] **Step 4: Создать `src/core/validate.ts`**

```ts
import type {
  DoorDef, Effect, InteractionRule, ItemDef, ItemPlacement,
  Level, RoomDef, TriggerDef,
} from './types';

export function roomBounds(room: RoomDef) {
  const [x, z, w, d] = room.rect;
  return { x0: x, x1: x + w, z0: z, z1: z + d };
}

function contains(room: RoomDef, x: number, z: number): boolean {
  const b = roomBounds(room);
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
}

const EPS = 1e-9;

/**
 * Лежит ли точка двери на стене, общей для двух комнат.
 *
 * Сначала определяется координата, В КОТОРОЙ комнаты соприкасаются, и точка двери
 * сверяется именно с ней. Проверять принадлежность точки любой из границ комнаты
 * нельзя: дверь, поставленная на дальнюю внешнюю стену, прошла бы проверку, хотя
 * второй комнаты там нет и близко.
 */
function onSharedWall(a: RoomDef, b: RoomDef, px: number, pz: number): boolean {
  const ba = roomBounds(a);
  const bb = roomBounds(b);

  let sharedX: number | null = null;
  if (Math.abs(ba.x1 - bb.x0) < EPS) sharedX = ba.x1;
  else if (Math.abs(bb.x1 - ba.x0) < EPS) sharedX = ba.x0;

  if (sharedX !== null && Math.abs(px - sharedX) < EPS) {
    const from = Math.max(ba.z0, bb.z0);
    const to = Math.min(ba.z1, bb.z1);
    if (pz >= from && pz <= to) return true;
  }

  let sharedZ: number | null = null;
  if (Math.abs(ba.z1 - bb.z0) < EPS) sharedZ = ba.z1;
  else if (Math.abs(bb.z1 - ba.z0) < EPS) sharedZ = ba.z0;

  if (sharedZ !== null && Math.abs(pz - sharedZ) < EPS) {
    const from = Math.max(ba.x0, bb.x0);
    const to = Math.min(ba.x1, bb.x1);
    if (px >= from && px <= to) return true;
  }

  return false;
}

function overlap(a: RoomDef, b: RoomDef): boolean {
  const ba = roomBounds(a);
  const bb = roomBounds(b);
  return ba.x0 < bb.x1 - EPS && bb.x0 < ba.x1 - EPS
      && ba.z0 < bb.z1 - EPS && bb.z0 < ba.z1 - EPS;
}

/** Сокращённая запись из JSON превращается в размеченное объединение. */
function parseEffect(raw: unknown, errors: string[]): Effect | null {
  if (typeof raw !== 'object' || raw === null) {
    errors.push(`Эффект должен быть объектом, получено: ${JSON.stringify(raw)}`);
    return null;
  }
  const e = raw as Record<string, unknown>;
  if (typeof e['take'] === 'string') return { kind: 'take', item: e['take'] };
  if (typeof e['consume'] === 'string') return { kind: 'consume', item: e['consume'] };
  if (typeof e['destroy'] === 'string') return { kind: 'destroy', object: e['destroy'] };
  if (typeof e['setFlag'] === 'string') return { kind: 'setFlag', flag: e['setFlag'] };
  if (typeof e['toggleDoor'] === 'string') return { kind: 'toggleDoor', door: e['toggleDoor'] };
  if (typeof e['say'] === 'string') return { kind: 'say', text: e['say'] };
  if (e['win'] === true) return { kind: 'win' };
  errors.push(`Неизвестный эффект: ${JSON.stringify(raw)}`);
  return null;
}

export function validateLevel(
  raw: unknown,
  itemDefs: Record<string, ItemDef>,
): { ok: true; level: Level } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['Файл уровня должен содержать объект.'] };
  }
  const lvl = raw as Record<string, unknown>;

  const rooms = (lvl['rooms'] ?? []) as RoomDef[];
  const doors = (lvl['doors'] ?? []) as DoorDef[];
  const items = (lvl['items'] ?? []) as ItemPlacement[];
  const triggers = (lvl['triggers'] ?? []) as TriggerDef[];
  const rawRules = (lvl['interactions'] ?? []) as Array<Record<string, unknown>>;

  if (rooms.length === 0) errors.push('В уровне нет ни одной комнаты.');

  const byId = new Map<string, RoomDef>();
  for (const room of rooms) {
    if (byId.has(room.id)) errors.push(`Комната "${room.id}" объявлена дважды.`);
    byId.set(room.id, room);
  }

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      if (overlap(a, b)) errors.push(`Комнаты "${a.id}" и "${b.id}" пересекаются.`);
    }
  }

  const locks = new Set<string>();
  for (const door of doors) {
    const [aId, bId] = door.between;
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a) errors.push(`Дверь "${door.id}" ссылается на несуществующую комнату "${aId}".`);
    if (!b) errors.push(`Дверь "${door.id}" ссылается на несуществующую комнату "${bId}".`);
    if (a && b && !onSharedWall(a, b, door.at[0], door.at[1])) {
      errors.push(
        `Дверь "${door.id}": точка (${door.at[0]}, ${door.at[1]}) не лежит на общей стене ` +
        `комнат "${aId}" и "${bId}".`,
      );
    }
    if (door.lock) locks.add(door.lock);
  }

  const seenDefs = new Set<string>();
  for (const item of items) {
    if (!itemDefs[item.def]) {
      errors.push(`Предмет ссылается на неизвестное определение "${item.def}".`);
    }
    if (seenDefs.has(item.def)) {
      errors.push(`Определение предмета "${item.def}" использовано дважды; в v1 допустим один экземпляр.`);
    }
    seenDefs.add(item.def);

    const room = byId.get(item.room);
    if (!room) {
      errors.push(`Предмет "${item.def}" лежит в несуществующей комнате "${item.room}".`);
    } else if (!contains(room, item.at[0], item.at[2])) {
      errors.push(`Предмет "${item.def}" расположен вне комнаты "${item.room}".`);
    }
  }

  for (const trigger of triggers) {
    const room = byId.get(trigger.room);
    if (!room) {
      errors.push(`Триггер "${trigger.id}" ссылается на несуществующую комнату "${trigger.room}".`);
      continue;
    }
    const [tx, tz, tw, td] = trigger.rect;
    if (!contains(room, tx, tz) || !contains(room, tx + tw, tz + td)) {
      errors.push(`Триггер "${trigger.id}" выходит за пределы комнаты "${trigger.room}".`);
    }
  }

  const interactions: InteractionRule[] = [];
  const opened = new Set<string>();
  for (const rule of rawRules) {
    const use = rule['use'];
    const on = rule['on'];
    if (typeof use !== 'string' || typeof on !== 'string') {
      errors.push(`Правило взаимодействия должно содержать строковые "use" и "on": ${JSON.stringify(rule)}`);
      continue;
    }
    if (!itemDefs[use]) errors.push(`Правило использует неизвестный предмет "${use}".`);
    const effects: Effect[] = [];
    for (const rawEffect of (rule['effects'] ?? []) as unknown[]) {
      const parsed = parseEffect(rawEffect, errors);
      if (parsed) {
        effects.push(parsed);
        if (parsed.kind === 'destroy') opened.add(parsed.object);
      }
    }
    interactions.push({ use, on, effects });
  }

  for (const lock of locks) {
    if (!opened.has(lock)) {
      errors.push(`Замок "${lock}" висит на двери, но ни одно правило его не открывает.`);
    }
  }

  const spawn = lvl['spawn'] as Level['spawn'] | undefined;
  if (!spawn) {
    errors.push('В уровне не задана точка появления игрока.');
  } else {
    const room = byId.get(spawn.room);
    if (!room) {
      errors.push(`Точка появления ссылается на несуществующую комнату "${spawn.room}".`);
    } else if (!contains(room, spawn.x, spawn.z)) {
      errors.push(`Точка появления игрока находится вне комнаты "${spawn.room}".`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    level: {
      id: String(lvl['id'] ?? 'level'),
      spawn: spawn!,
      rooms, doors, items, triggers, interactions, itemDefs,
    },
  };
}
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

Run: `npm test src/core/validate.test.ts`
Expected: PASS, 13 тестов.

- [ ] **Step 6: Коммит**

```bash
git add src/core/types.ts src/core/validate.ts src/core/validate.test.ts
git commit -m "Add level types and validation"
```

---

### Task 3: Генерация коллайдеров из уровня

**Files:**
- Create: `src/core/colliders.ts`
- Test: `src/core/colliders.test.ts`

**Interfaces:**
- Consumes: `Level`, `RoomDef`, `DoorDef` и `roomBounds` из Task 2; `ROOM`, `DOOR` из Task 1
- Produces:
  - `interface Aabb { x0: number; x1: number; z0: number; z1: number; doorId?: string }`
  - `buildColliders(level: Level): Aabb[]` — стены комнат с вырезанными проёмами плюс по одному коллайдеру на дверь, помеченному `doorId`
  - `activeColliders(all: Aabb[], openDoors: ReadonlySet<string>): Aabb[]` — отбрасывает коллайдеры открытых дверей

- [ ] **Step 1: Написать падающие тесты**

Создать `src/core/colliders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildColliders, activeColliders } from './colliders';
import { validateLevel } from './validate';
import type { ItemDef } from './types';

const itemDefs: Record<string, ItemDef> = {};

function twoRooms() {
  const raw = {
    id: 't',
    spawn: { room: 'a', x: 2, z: 2, yaw: 0 },
    rooms: [
      { id: 'a', rect: [0, 0, 8, 6], color: '#888', light: 1 },
      { id: 'b', rect: [8, 2, 6, 2], color: '#888', light: 1 },
    ],
    doors: [{ id: 'd_ab', between: ['a', 'b'], at: [8, 3] }],
    items: [], triggers: [], interactions: [],
  };
  const result = validateLevel(raw, itemDefs);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.level;
}

function covers(boxes: ReturnType<typeof buildColliders>, x: number, z: number): boolean {
  return boxes.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
}

describe('buildColliders', () => {
  it('перекрывает стены комнаты', () => {
    const boxes = buildColliders(twoRooms());
    expect(covers(boxes, 0, 3)).toBe(true);   // западная стена комнаты a
    expect(covers(boxes, 4, 0)).toBe(true);   // северная стена комнаты a
  });

  it('оставляет середину комнаты проходимой', () => {
    const boxes = buildColliders(twoRooms());
    expect(covers(boxes, 4, 3)).toBe(false);
  });

  it('помечает коллайдер двери её идентификатором', () => {
    const boxes = buildColliders(twoRooms());
    expect(boxes.filter((b) => b.doorId === 'd_ab')).toHaveLength(1);
  });

  it('вырезает проём в стене, оставляя дверь единственной преградой', () => {
    const boxes = buildColliders(twoRooms());
    const withoutDoor = boxes.filter((b) => b.doorId === undefined);
    expect(withoutDoor.some((b) => 8 >= b.x0 && 8 <= b.x1 && 3 >= b.z0 && 3 <= b.z1)).toBe(false);
  });

  it('оставляет стену по бокам от проёма', () => {
    const boxes = buildColliders(twoRooms()).filter((b) => b.doorId === undefined);
    expect(boxes.some((b) => 8 >= b.x0 && 8 <= b.x1 && 2.2 >= b.z0 && 2.2 <= b.z1)).toBe(true);
  });
});

describe('activeColliders', () => {
  it('убирает коллайдер открытой двери', () => {
    const all = buildColliders(twoRooms());
    const active = activeColliders(all, new Set(['d_ab']));
    expect(active.some((b) => b.doorId === 'd_ab')).toBe(false);
    expect(active.length).toBe(all.length - 1);
  });

  it('оставляет коллайдер закрытой двери', () => {
    const all = buildColliders(twoRooms());
    expect(activeColliders(all, new Set()).length).toBe(all.length);
  });
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `npm test src/core/colliders.test.ts`
Expected: FAIL — `Failed to resolve import "./colliders"`.

- [ ] **Step 3: Создать `src/core/colliders.ts`**

```ts
import { DOOR, ROOM } from '../config';
import { roomBounds } from './validate';
import type { DoorDef, Level } from './types';

export interface Aabb {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Задан только у коллайдеров дверных створок. */
  doorId?: string;
}

type Segment = { from: number; to: number };

/** Вычитает из отрезка проёмы, оставляя куски стены. */
function subtract(segment: Segment, holes: Segment[]): Segment[] {
  let parts: Segment[] = [segment];
  for (const hole of holes) {
    const next: Segment[] = [];
    for (const part of parts) {
      if (hole.to <= part.from || hole.from >= part.to) { next.push(part); continue; }
      if (hole.from > part.from) next.push({ from: part.from, to: hole.from });
      if (hole.to < part.to) next.push({ from: hole.to, to: part.to });
    }
    parts = next;
  }
  return parts.filter((p) => p.to - p.from > 1e-6);
}

/** Половина толщины: используется только для створки двери, стоящей по центру границы. */
const half = ROOM.wallThickness / 2;

export function buildColliders(level: Level): Aabb[] {
  const boxes: Aabb[] = [];
  const doorHalf = DOOR.width / 2;

  for (const room of level.rooms) {
    const b = roomBounds(room);

    // Проёмы, приходящиеся на каждую из четырёх стен комнаты.
    const holesOnWest: Segment[] = [];
    const holesOnEast: Segment[] = [];
    const holesOnNorth: Segment[] = [];
    const holesOnSouth: Segment[] = [];

    for (const door of level.doors) {
      if (!door.between.includes(room.id)) continue;
      const [dx, dz] = door.at;
      if (Math.abs(dx - b.x0) < 1e-9) holesOnWest.push({ from: dz - doorHalf, to: dz + doorHalf });
      else if (Math.abs(dx - b.x1) < 1e-9) holesOnEast.push({ from: dz - doorHalf, to: dz + doorHalf });
      else if (Math.abs(dz - b.z0) < 1e-9) holesOnNorth.push({ from: dx - doorHalf, to: dx + doorHalf });
      else if (Math.abs(dz - b.z1) < 1e-9) holesOnSouth.push({ from: dx - doorHalf, to: dx + doorHalf });
    }

    // Стены строятся ВНУТРЬ комнаты, а не по центру границы. Иначе стены двух
    // соседних комнат оказались бы в одной плоскости, и рендер получил бы
    // z-fighting там, где комнаты разной длины делят стену.
    const t = ROOM.wallThickness;
    for (const seg of subtract({ from: b.z0, to: b.z1 }, holesOnWest)) {
      boxes.push({ x0: b.x0, x1: b.x0 + t, z0: seg.from, z1: seg.to });
    }
    for (const seg of subtract({ from: b.z0, to: b.z1 }, holesOnEast)) {
      boxes.push({ x0: b.x1 - t, x1: b.x1, z0: seg.from, z1: seg.to });
    }
    for (const seg of subtract({ from: b.x0, to: b.x1 }, holesOnNorth)) {
      boxes.push({ x0: seg.from, x1: seg.to, z0: b.z0, z1: b.z0 + t });
    }
    for (const seg of subtract({ from: b.x0, to: b.x1 }, holesOnSouth)) {
      boxes.push({ x0: seg.from, x1: seg.to, z0: b.z1 - t, z1: b.z1 });
    }
  }

  for (const door of level.doors) {
    boxes.push(doorCollider(door, level));
  }

  return boxes;
}

function doorCollider(door: DoorDef, level: Level): Aabb {
  const [dx, dz] = door.at;
  const doorHalf = DOOR.width / 2;
  const room = level.rooms.find((r) => r.id === door.between[0])!;
  const b = roomBounds(room);
  const onVerticalWall = Math.abs(dx - b.x0) < 1e-9 || Math.abs(dx - b.x1) < 1e-9;

  return onVerticalWall
    ? { x0: dx - half, x1: dx + half, z0: dz - doorHalf, z1: dz + doorHalf, doorId: door.id }
    : { x0: dx - doorHalf, x1: dx + doorHalf, z0: dz - half, z1: dz + half, doorId: door.id };
}

export function activeColliders(all: Aabb[], openDoors: ReadonlySet<string>): Aabb[] {
  return all.filter((b) => b.doorId === undefined || !openDoors.has(b.doorId));
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `npm test src/core/colliders.test.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Коммит**

```bash
git add src/core/colliders.ts src/core/colliders.test.ts
git commit -m "Add collider generation from level data"
```

---

### Task 4: Разрешение движения среди стен

Игрок — круг в плоскости XZ, стены — прямоугольники. Движение разрешается раздельно по осям, что бесплатно даёт скольжение вдоль стены. Sweep не нужен: при 3 м/с и кадре 16 мс смещение 5 см при радиусе 30 см.

**Files:**
- Create: `src/core/collision.ts`
- Test: `src/core/collision.test.ts`

**Interfaces:**
- Consumes: `Aabb` из Task 3
- Produces:
  - `interface Vec2 { x: number; z: number }`
  - `resolveMove(pos: Vec2, delta: Vec2, radius: number, boxes: readonly Aabb[]): Vec2`

- [ ] **Step 1: Написать падающие тесты**

Создать `src/core/collision.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveMove } from './collision';
import type { Aabb } from './colliders';

/** Вертикальная стена: полоса по x от 5.0 до 5.2, тянется по z от 0 до 10. */
const wallEast: Aabb = { x0: 5, x1: 5.2, z0: 0, z1: 10 };
/** Горизонтальная стена: полоса по z от 8.0 до 8.2, тянется по x от 0 до 10. */
const wallSouth: Aabb = { x0: 0, x1: 10, z0: 8, z1: 8.2 };

const R = 0.3;

describe('resolveMove', () => {
  it('не мешает движению в пустоте', () => {
    const result = resolveMove({ x: 1, z: 1 }, { x: 0.5, z: 0.25 }, R, []);
    expect(result).toEqual({ x: 1.5, z: 1.25 });
  });

  it('останавливает у стены на расстоянии радиуса', () => {
    const result = resolveMove({ x: 4, z: 3 }, { x: 2, z: 0 }, R, [wallEast]);
    expect(result.x).toBeCloseTo(4.7, 6);
    expect(result.z).toBeCloseTo(3, 6);
  });

  it('останавливает при подходе с другой стороны', () => {
    const result = resolveMove({ x: 6, z: 3 }, { x: -2, z: 0 }, R, [wallEast]);
    expect(result.x).toBeCloseTo(5.5, 6);
  });

  it('даёт скользить вдоль стены при движении по диагонали', () => {
    const result = resolveMove({ x: 4.6, z: 3 }, { x: 1, z: 1 }, R, [wallEast]);
    expect(result.x).toBeCloseTo(4.7, 6);
    expect(result.z).toBeCloseTo(4, 6);
  });

  it('останавливает по обеим осям в углу', () => {
    const result = resolveMove({ x: 4.6, z: 7.6 }, { x: 1, z: 1 }, R, [wallEast, wallSouth]);
    expect(result.x).toBeCloseTo(4.7, 6);
    expect(result.z).toBeCloseTo(7.7, 6);
  });

  it('не двигает при нулевой дельте', () => {
    const result = resolveMove({ x: 4.7, z: 3 }, { x: 0, z: 0 }, R, [wallEast]);
    expect(result).toEqual({ x: 4.7, z: 3 });
  });

  it('не запирает игрока, который уже оказался внутри стены', () => {
    // Штатный сценарий: игрок стоит в проёме и закрывает дверь — коллайдер створки
    // возвращается уже вокруг него. Выйти он обязан в любую сторону.
    const out = resolveMove({ x: 5.1, z: 3 }, { x: -1, z: 0 }, R, [wallEast]);
    expect(out.x).toBeCloseTo(4.1, 6);
    const through = resolveMove({ x: 5.1, z: 3 }, { x: 1, z: 0 }, R, [wallEast]);
    expect(through.x).toBeCloseTo(6.1, 6);
  });

  it('пропускает игрока в дверной проём между кусками стены', () => {
    const left: Aabb = { x0: 5, x1: 5.2, z0: 0, z1: 2.5 };
    const right: Aabb = { x0: 5, x1: 5.2, z0: 3.5, z1: 10 };
    const result = resolveMove({ x: 4.5, z: 3 }, { x: 1, z: 0 }, R, [left, right]);
    expect(result.x).toBeCloseTo(5.5, 6);
  });
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `npm test src/core/collision.test.ts`
Expected: FAIL — `Failed to resolve import "./collision"`.

- [ ] **Step 3: Создать `src/core/collision.ts`**

```ts
import type { Aabb } from './colliders';

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Двигает круг радиуса `radius` из `pos` на `delta`, не пуская его в прямоугольники.
 * Оси разрешаются по очереди — благодаря этому игрок скользит вдоль стены,
 * а не залипает при движении по диагонали.
 *
 * Инвариант: если стартовая позиция УЖЕ внутри прямоугольника, по этой оси обрезка
 * не применяется и игрок движется свободно. Это намеренно. Такое положение возникает
 * штатно: игрок стоит в проёме и закрывает дверь, коллайдер створки возвращается
 * уже вокруг него. Из этого положения он обязан выйти, а не остаться запертым
 * навсегда. Обычный кадр всегда стартует из разрешённой на прошлом кадре позиции,
 * поэтому на нормальный ход движения это не влияет.
 */
export function resolveMove(
  pos: Vec2,
  delta: Vec2,
  radius: number,
  boxes: readonly Aabb[],
): Vec2 {
  let x = pos.x;
  let z = pos.z;

  if (delta.x !== 0) {
    let nextX = x + delta.x;
    for (const b of boxes) {
      if (z <= b.z0 - radius || z >= b.z1 + radius) continue;
      if (delta.x > 0 && x <= b.x0 - radius && nextX > b.x0 - radius) {
        nextX = Math.min(nextX, b.x0 - radius);
      } else if (delta.x < 0 && x >= b.x1 + radius && nextX < b.x1 + radius) {
        nextX = Math.max(nextX, b.x1 + radius);
      }
    }
    x = nextX;
  }

  if (delta.z !== 0) {
    let nextZ = z + delta.z;
    for (const b of boxes) {
      if (x <= b.x0 - radius || x >= b.x1 + radius) continue;
      if (delta.z > 0 && z <= b.z0 - radius && nextZ > b.z0 - radius) {
        nextZ = Math.min(nextZ, b.z0 - radius);
      } else if (delta.z < 0 && z >= b.z1 + radius && nextZ < b.z1 + radius) {
        nextZ = Math.max(nextZ, b.z1 + radius);
      }
    }
    z = nextZ;
  }

  return { x, z };
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `npm test src/core/collision.test.ts`
Expected: PASS, 8 тестов.

- [ ] **Step 5: Коммит**

```bash
git add src/core/collision.ts src/core/collision.test.ts
git commit -m "Add axis-separated movement resolution"
```

---

### Task 5: Инвентарь как проекция расположения предметов

Отдельного массива инвентаря нет. Единственный источник правды — карта расположений; инвентарь и рука вычисляются из неё. Это убирает целый класс багов с рассинхроном.

**Files:**
- Create: `src/core/inventory.ts`
- Test: `src/core/inventory.test.ts`

**Interfaces:**
- Consumes: `ItemLocation` из Task 2
- Produces:
  - `type Locations = Map<string, ItemLocation>`
  - `inventoryItems(locations: Locations): string[]`
  - `heldItem(locations: Locations): string | null`
  - `itemsInRoom(locations: Locations, room: string): string[]`
  - `setHeld(locations: Locations, item: string | null): void`

- [ ] **Step 1: Написать падающие тесты**

Создать `src/core/inventory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inventoryItems, heldItem, itemsInRoom, setHeld, type Locations } from './inventory';

function locations(): Locations {
  return new Map([
    ['key_brass', { kind: 'inventory' }],
    ['rock', { kind: 'world', room: 'a', at: [1, 0.9, 1] }],
    ['ash', { kind: 'gone' }],
  ]);
}

describe('inventory', () => {
  it('в инвентаре только предметы с расположением inventory', () => {
    expect(inventoryItems(locations())).toEqual(['key_brass']);
  });

  it('в руках пусто, пока ничего не взято', () => {
    expect(heldItem(locations())).toBeNull();
  });

  it('в комнате видны только лежащие в ней предметы', () => {
    expect(itemsInRoom(locations(), 'a')).toEqual(['rock']);
    expect(itemsInRoom(locations(), 'b')).toEqual([]);
  });

  it('взятие в руки убирает предмет из инвентаря', () => {
    const loc = locations();
    setHeld(loc, 'key_brass');
    expect(heldItem(loc)).toBe('key_brass');
    expect(inventoryItems(loc)).toEqual([]);
  });

  it('взятие другого предмета возвращает прежний в инвентарь', () => {
    const loc = locations();
    loc.set('rock', { kind: 'inventory' });
    setHeld(loc, 'key_brass');
    setHeld(loc, 'rock');
    expect(heldItem(loc)).toBe('rock');
    expect(inventoryItems(loc)).toEqual(['key_brass']);
  });

  it('снятие с руки возвращает предмет в инвентарь', () => {
    const loc = locations();
    setHeld(loc, 'key_brass');
    setHeld(loc, null);
    expect(heldItem(loc)).toBeNull();
    expect(inventoryItems(loc)).toEqual(['key_brass']);
  });

  it('предмет не может оказаться в двух местах сразу', () => {
    const loc = locations();
    setHeld(loc, 'key_brass');
    const places = [...loc.values()].filter((l) => l.kind === 'hand');
    expect(places).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `npm test src/core/inventory.test.ts`
Expected: FAIL — `Failed to resolve import "./inventory"`.

- [ ] **Step 3: Создать `src/core/inventory.ts`**

```ts
import type { ItemLocation } from './types';

export type Locations = Map<string, ItemLocation>;

export function inventoryItems(locations: Locations): string[] {
  const result: string[] = [];
  for (const [id, loc] of locations) {
    if (loc.kind === 'inventory') result.push(id);
  }
  return result;
}

export function heldItem(locations: Locations): string | null {
  for (const [id, loc] of locations) {
    if (loc.kind === 'hand') return id;
  }
  return null;
}

export function itemsInRoom(locations: Locations, room: string): string[] {
  const result: string[] = [];
  for (const [id, loc] of locations) {
    if (loc.kind === 'world' && loc.room === room) result.push(id);
  }
  return result;
}

/**
 * Переводит предмет в руку. Предыдущий возвращается в инвентарь.
 * Передача `null` просто освобождает руки.
 */
export function setHeld(locations: Locations, item: string | null): void {
  const previous = heldItem(locations);
  if (previous !== null) locations.set(previous, { kind: 'inventory' });
  if (item !== null) locations.set(item, { kind: 'hand' });
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `npm test src/core/inventory.test.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Коммит**

```bash
git add src/core/inventory.ts src/core/inventory.test.ts
git commit -m "Add inventory as a projection of item locations"
```

---

### Task 6: Состояние мира, эффекты и события

**Files:**
- Create: `src/core/world.ts`, `src/core/test-fixtures.ts`
- Test: `src/core/world.test.ts`

**Interfaces:**
- Consumes: `Level`, `Effect`, `ItemLocation` из Task 2; функции инвентаря из Task 5
- Produces:
  - `type WorldEvent` — размеченное объединение с вариантами `itemTaken`, `itemGone`, `objectDestroyed`, `doorOpened`, `doorClosed`, `handChanged`, `said`, `won`
  - `class World` с полями и методами: `readonly level`, `won`, `on(listener)`, `applyEffects(effects)`, `held()`, `inventory()`, `locationOf(id)`, `isDestroyed(id)`, `isDoorOpen(id)`, `hasFlag(f)`, `openDoors()`, `setHeld(item)`, `checkTriggers(x, z)`
  - `makeTestLevel(): Level` и `TEST_ITEM_DEFS` из `test-fixtures.ts`

- [ ] **Step 1: Создать общую тестовую фикстуру**

Создать `src/core/test-fixtures.ts`:

```ts
import { validateLevel } from './validate';
import type { ItemDef, Level } from './types';

export const TEST_ITEM_DEFS: Record<string, ItemDef> = {
  key_brass: { id: 'key_brass', name: 'Латунный ключ', holdable: true },
  rock: { id: 'rock', name: 'Камень', holdable: true },
};

/** Две комнаты, запертая дверь между ними, ключ и камень на полу, триггер победы во второй. */
export function makeTestLevel(): Level {
  const raw = {
    id: 'fixture',
    spawn: { room: 'a', x: 2, z: 3, yaw: 0 },
    rooms: [
      { id: 'a', rect: [0, 0, 8, 6], color: '#888', light: 1 },
      { id: 'b', rect: [8, 2, 6, 2], color: '#888', light: 1 },
    ],
    doors: [{ id: 'd_ab', between: ['a', 'b'], at: [8, 3], lock: 'lock_ab' }],
    items: [
      { def: 'key_brass', room: 'a', at: [2, 0.9, 4] },
      { def: 'rock', room: 'a', at: [3, 0.9, 4] },
    ],
    triggers: [{ id: 'win', room: 'b', rect: [12, 2, 2, 2], effect: 'win' }],
    interactions: [
      {
        use: 'key_brass',
        on: 'lock_ab',
        effects: [{ destroy: 'lock_ab' }, { consume: 'key_brass' }, { say: 'Замок щёлкнул.' }],
      },
    ],
  };
  const result = validateLevel(raw, TEST_ITEM_DEFS);
  if (!result.ok) throw new Error('Фикстура невалидна:\n' + result.errors.join('\n'));
  return result.level;
}
```

- [ ] **Step 2: Написать падающие тесты**

Создать `src/core/world.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { World, type WorldEvent } from './world';
import { makeTestLevel } from './test-fixtures';

function world() {
  const w = new World(makeTestLevel());
  const events: WorldEvent[] = [];
  w.on((e) => events.push(e));
  return { w, events };
}

describe('World', () => {
  it('раскладывает предметы по комнатам при создании', () => {
    const { w } = world();
    expect(w.locationOf('key_brass')).toEqual({ kind: 'world', room: 'a', at: [2, 0.9, 4] });
  });

  it('take переносит предмет в инвентарь и сообщает об этом', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'take', item: 'key_brass' }]);
    expect(w.inventory()).toContain('key_brass');
    expect(events).toContainEqual({ kind: 'itemTaken', item: 'key_brass' });
  });

  it('consume убирает предмет насовсем', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'take', item: 'key_brass' }]);
    w.setHeld('key_brass');
    w.applyEffects([{ kind: 'consume', item: 'key_brass' }]);
    expect(w.held()).toBeNull();
    expect(w.inventory()).toEqual([]);
    expect(events).toContainEqual({ kind: 'itemGone', item: 'key_brass' });
  });

  it('destroy помечает объект уничтоженным', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'destroy', object: 'lock_ab' }]);
    expect(w.isDestroyed('lock_ab')).toBe(true);
    expect(events).toContainEqual({ kind: 'objectDestroyed', object: 'lock_ab' });
  });

  it('toggleDoor открывает и закрывает дверь', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'toggleDoor', door: 'd_ab' }]);
    expect(w.isDoorOpen('d_ab')).toBe(true);
    w.applyEffects([{ kind: 'toggleDoor', door: 'd_ab' }]);
    expect(w.isDoorOpen('d_ab')).toBe(false);
    expect(events).toContainEqual({ kind: 'doorOpened', door: 'd_ab' });
    expect(events).toContainEqual({ kind: 'doorClosed', door: 'd_ab' });
  });

  it('say и setFlag работают', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'say', text: 'Щёлк.' }, { kind: 'setFlag', flag: 'power' }]);
    expect(w.hasFlag('power')).toBe(true);
    expect(events).toContainEqual({ kind: 'said', text: 'Щёлк.' });
  });

  it('вход в триггер приводит к победе', () => {
    const { w, events } = world();
    w.checkTriggers(13, 3);
    expect(w.won).toBe(true);
    expect(events).toContainEqual({ kind: 'won' });
  });

  it('вне триггера победы не происходит', () => {
    const { w } = world();
    w.checkTriggers(2, 3);
    expect(w.won).toBe(false);
  });

  it('победа срабатывает один раз', () => {
    const { w, events } = world();
    w.checkTriggers(13, 3);
    w.checkTriggers(13, 3);
    expect(events.filter((e) => e.kind === 'won')).toHaveLength(1);
  });

  it('openDoors отдаёт множество для отбора коллайдеров', () => {
    const { w } = world();
    w.applyEffects([{ kind: 'toggleDoor', door: 'd_ab' }]);
    expect([...w.openDoors()]).toEqual(['d_ab']);
  });
});
```

- [ ] **Step 3: Запустить тесты и убедиться, что они падают**

Run: `npm test src/core/world.test.ts`
Expected: FAIL — `Failed to resolve import "./world"`.

- [ ] **Step 4: Создать `src/core/world.ts`**

Метод `describe`/`interact` появится в Task 7; сейчас класс отвечает только за состояние.

```ts
import { heldItem, inventoryItems, itemsInRoom, setHeld, type Locations } from './inventory';
import type { Effect, ItemLocation, Level } from './types';

export type WorldEvent =
  | { kind: 'itemTaken'; item: string }
  | { kind: 'itemGone'; item: string }
  | { kind: 'objectDestroyed'; object: string }
  | { kind: 'doorOpened'; door: string }
  | { kind: 'doorClosed'; door: string }
  | { kind: 'handChanged'; item: string | null }
  | { kind: 'said'; text: string }
  | { kind: 'won' };

export class World {
  private readonly locations: Locations = new Map();
  private readonly destroyedIds = new Set<string>();
  private readonly openDoorIds = new Set<string>();
  private readonly flags = new Set<string>();
  private readonly listeners: Array<(event: WorldEvent) => void> = [];

  won = false;

  constructor(readonly level: Level) {
    for (const placement of level.items) {
      this.locations.set(placement.def, {
        kind: 'world',
        room: placement.room,
        at: placement.at,
      });
    }
  }

  on(listener: (event: WorldEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: WorldEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  held(): string | null { return heldItem(this.locations); }
  inventory(): string[] { return inventoryItems(this.locations); }
  itemsOnFloor(room: string): string[] { return itemsInRoom(this.locations, room); }
  locationOf(item: string): ItemLocation | undefined { return this.locations.get(item); }
  isDestroyed(id: string): boolean { return this.destroyedIds.has(id); }
  isDoorOpen(id: string): boolean { return this.openDoorIds.has(id); }
  hasFlag(flag: string): boolean { return this.flags.has(flag); }
  openDoors(): ReadonlySet<string> { return this.openDoorIds; }

  setHeld(item: string | null): void {
    setHeld(this.locations, item);
    this.emit({ kind: 'handChanged', item });
  }

  applyEffects(effects: readonly Effect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'take':
          this.locations.set(effect.item, { kind: 'inventory' });
          this.emit({ kind: 'itemTaken', item: effect.item });
          break;
        case 'consume':
          this.locations.set(effect.item, { kind: 'gone' });
          this.emit({ kind: 'itemGone', item: effect.item });
          break;
        case 'destroy':
          this.destroyedIds.add(effect.object);
          this.emit({ kind: 'objectDestroyed', object: effect.object });
          break;
        case 'toggleDoor':
          if (this.openDoorIds.delete(effect.door)) {
            this.emit({ kind: 'doorClosed', door: effect.door });
          } else {
            this.openDoorIds.add(effect.door);
            this.emit({ kind: 'doorOpened', door: effect.door });
          }
          break;
        case 'setFlag':
          this.flags.add(effect.flag);
          break;
        case 'say':
          this.emit({ kind: 'said', text: effect.text });
          break;
        case 'win':
          this.won = true;
          this.emit({ kind: 'won' });
          break;
      }
    }
  }

  /** Вызывается каждый кадр с текущей позицией игрока. */
  checkTriggers(x: number, z: number): void {
    if (this.won) return;
    for (const trigger of this.level.triggers) {
      const [tx, tz, tw, td] = trigger.rect;
      if (x >= tx && x <= tx + tw && z >= tz && z <= tz + td) {
        this.applyEffects([{ kind: 'win' }]);
        return;
      }
    }
  }
}
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

Run: `npm test src/core/world.test.ts`
Expected: PASS, 10 тестов.

- [ ] **Step 6: Коммит**

```bash
git add src/core/world.ts src/core/test-fixtures.ts src/core/world.test.ts
git commit -m "Add world state, effects and events"
```

---

### Task 7: Разрешение взаимодействий, describe и apply

Главный инвариант проекта: подсказка не может соврать. Достигается тем, что `describe` и `interact` вызывают **один и тот же** код разрешения, а не два похожих.

**Files:**
- Create: `src/core/interactions.ts`
- Modify: `src/core/world.ts` — добавить методы `describe` и `interact`
- Test: `src/core/interactions.test.ts`

**Interfaces:**
- Consumes: `Level`, `Effect`, `ItemLocation` из Task 2; `World` из Task 6
- Produces:
  - `type Outcome = { ok: true; prompt: string; effects: Effect[] } | { ok: false; refusal: string }`
  - `interface WorldView` — то, что нужно разрешению от мира: `level`, `held()`, `locationOf()`, `isDestroyed()`, `isDoorOpen()`
  - `resolveInteraction(view: WorldView, targetId: string): Outcome`
  - методы `World.describe(targetId): Outcome` и `World.interact(targetId): Outcome`

- [ ] **Step 1: Написать падающие тесты**

Создать `src/core/interactions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { World } from './world';
import { makeTestLevel } from './test-fixtures';

function armed(held: string | null): World {
  const w = new World(makeTestLevel());
  if (held) {
    w.applyEffects([{ kind: 'take', item: held }]);
    w.setHeld(held);
  }
  return w;
}

describe('resolveInteraction', () => {
  it('предлагает подобрать лежащий предмет', () => {
    const outcome = armed(null).describe('key_brass');
    expect(outcome).toEqual({
      ok: true,
      prompt: 'Подобрать: Латунный ключ',
      effects: [{ kind: 'take', item: 'key_brass' }],
    });
  });

  it('подобранный предмет перестаёт быть целью', () => {
    const w = armed(null);
    w.interact('key_brass');
    expect(w.describe('key_brass').ok).toBe(false);
  });

  it('отказывает открыть дверь, пока цел замок', () => {
    const outcome = armed(null).describe('d_ab');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal).toContain('замок');
  });

  it('без предмета в руках замок открыть нечем', () => {
    const outcome = armed(null).describe('lock_ab');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal).toContain('Нужно чем-то открыть');
  });

  it('неподходящий предмет получает внятный отказ', () => {
    const outcome = armed('rock').describe('lock_ab');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal).toContain('Камень');
  });

  it('правило из реестра срабатывает на подходящий предмет', () => {
    const w = armed('key_brass');
    const outcome = w.interact('lock_ab');
    expect(outcome.ok).toBe(true);
    expect(w.isDestroyed('lock_ab')).toBe(true);
    expect(w.held()).toBeNull();
  });

  it('после снятия замка дверь открывается', () => {
    const w = armed('key_brass');
    w.interact('lock_ab');
    const outcome = w.interact('d_ab');
    expect(outcome.ok).toBe(true);
    expect(w.isDoorOpen('d_ab')).toBe(true);
  });

  it('открытая дверь предлагает закрыться', () => {
    const w = armed('key_brass');
    w.interact('lock_ab');
    w.interact('d_ab');
    const outcome = w.describe('d_ab');
    expect(outcome.ok && outcome.prompt).toBe('Закрыть дверь');
  });

  it('неизвестная цель даёт отказ, а не исключение', () => {
    expect(armed(null).describe('ничего').ok).toBe(false);
  });

  it('отказ не меняет состояние мира', () => {
    const w = armed('rock');
    w.interact('lock_ab');
    expect(w.isDestroyed('lock_ab')).toBe(false);
    expect(w.held()).toBe('rock');
  });

  it('сценарий целиком: ключ, замок, дверь, выход', () => {
    const w = new World(makeTestLevel());
    expect(w.interact('key_brass').ok).toBe(true);
    w.setHeld('key_brass');
    expect(w.interact('lock_ab').ok).toBe(true);
    expect(w.interact('d_ab').ok).toBe(true);
    w.checkTriggers(13, 3);
    expect(w.won).toBe(true);
  });

  it('describe и interact никогда не расходятся', () => {
    const targets = ['key_brass', 'rock', 'd_ab', 'lock_ab', 'ничего'];
    const hands = [null, 'key_brass', 'rock'];

    for (const held of hands) {
      for (const target of targets) {
        const described = armed(held).describe(target);
        const applied = armed(held).interact(target);

        expect(applied.ok).toBe(described.ok);
        if (described.ok && applied.ok) {
          expect(applied.prompt).toBe(described.prompt);
          expect(applied.effects).toEqual(described.effects);
        } else if (!described.ok && !applied.ok) {
          expect(applied.refusal).toBe(described.refusal);
        }
      }
    }
  });

  it('describe не меняет состояние мира', () => {
    const w = armed('key_brass');
    w.describe('lock_ab');
    expect(w.isDestroyed('lock_ab')).toBe(false);
    expect(w.held()).toBe('key_brass');
  });
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `npm test src/core/interactions.test.ts`
Expected: FAIL — у `World` нет методов `describe` и `interact`.

- [ ] **Step 3: Создать `src/core/interactions.ts`**

```ts
import type { DoorDef, Effect, ItemLocation, Level } from './types';

export type Outcome =
  | { ok: true; prompt: string; effects: Effect[] }
  | { ok: false; refusal: string };

/** Ровно то, что разрешению нужно от мира. Позволяет обойтись без циклического импорта. */
export interface WorldView {
  readonly level: Level;
  held(): string | null;
  locationOf(item: string): ItemLocation | undefined;
  isDestroyed(id: string): boolean;
  isDoorOpen(id: string): boolean;
}

type Target =
  | { kind: 'item'; id: string }
  | { kind: 'lock'; id: string }
  | { kind: 'door'; door: DoorDef };

function classify(view: WorldView, targetId: string): Target | null {
  if (view.level.itemDefs[targetId]) {
    const location = view.locationOf(targetId);
    return location?.kind === 'world' ? { kind: 'item', id: targetId } : null;
  }

  const lockedDoor = view.level.doors.find((d) => d.lock === targetId);
  if (lockedDoor) {
    return view.isDestroyed(targetId) ? null : { kind: 'lock', id: targetId };
  }

  const door = view.level.doors.find((d) => d.id === targetId);
  if (door) return { kind: 'door', door };

  return null;
}

function nameOf(view: WorldView, itemId: string): string {
  return view.level.itemDefs[itemId]?.name ?? itemId;
}

/**
 * Единственная точка принятия решения о взаимодействии.
 * Вызывается и для подсказки, и для действия — поэтому подсказка не может соврать.
 */
export function resolveInteraction(view: WorldView, targetId: string): Outcome {
  const target = classify(view, targetId);
  if (!target) return { ok: false, refusal: 'Здесь не с чем взаимодействовать.' };

  const held = view.held();

  if (held !== null) {
    const rule = view.level.interactions.find((r) => r.use === held && r.on === targetId);
    if (rule) {
      return { ok: true, prompt: `Использовать: ${nameOf(view, held)}`, effects: rule.effects };
    }
  }

  switch (target.kind) {
    case 'item':
      return {
        ok: true,
        prompt: `Подобрать: ${nameOf(view, target.id)}`,
        effects: [{ kind: 'take', item: target.id }],
      };

    case 'lock':
      return held === null
        ? { ok: false, refusal: 'Замок заперт. Нужно чем-то открыть.' }
        : { ok: false, refusal: `${nameOf(view, held)} сюда не подходит.` };

    case 'door': {
      const { door } = target;
      if (door.lock !== undefined && !view.isDestroyed(door.lock)) {
        return { ok: false, refusal: 'Заперто. На двери висит замок.' };
      }
      return {
        ok: true,
        prompt: view.isDoorOpen(door.id) ? 'Закрыть дверь' : 'Открыть дверь',
        effects: [{ kind: 'toggleDoor', door: door.id }],
      };
    }
  }
}
```

- [ ] **Step 4: Добавить `describe` и `interact` в `src/core/world.ts`**

Дописать импорт в начало файла:

```ts
import { resolveInteraction, type Outcome, type WorldView } from './interactions';
```

Поменять объявление класса на `export class World implements WorldView {` и добавить два метода перед `applyEffects`:

```ts
  /** Что произойдёт, если сейчас нажать «взаимодействовать». Состояние не меняется. */
  describe(targetId: string): Outcome {
    return resolveInteraction(this, targetId);
  }

  /** То же решение, но применённое. */
  interact(targetId: string): Outcome {
    const outcome = resolveInteraction(this, targetId);
    if (outcome.ok) this.applyEffects(outcome.effects);
    return outcome;
  }
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

Run: `npm test src/core/interactions.test.ts`
Expected: PASS, 13 тестов.

- [ ] **Step 6: Прогнать весь набор — ядро закончено**

Run: `npm test`
Expected: PASS, все файлы зелёные. На этом `src/core/` полностью реализован и покрыт.

- [ ] **Step 7: Коммит**

```bash
git add src/core/interactions.ts src/core/interactions.test.ts src/core/world.ts
git commit -m "Add interaction resolution with describe/apply invariant"
```

---

### Task 8: Карта уровня и видимая геометрия комнат

Первая задача, где что-то видно глазами. Ядро уже готово, поэтому геометрия строится из тех же данных, что и коллайдеры.

**Files:**
- Create: `src/levels/items.json`, `src/levels/level_01.json`, `src/levels/index.ts`
- Create: `src/render/materials.ts`, `src/render/walls.ts`, `src/render/scene.ts`
- Create: `src/main.ts`

**Interfaces:**
- Consumes: `validateLevel` из Task 2, `buildColliders` из Task 3, `ROOM`/`DOOR`/`PLAYER` из Task 1
- Produces:
  - `loadLevel(): { ok: true; level: Level } | { ok: false; errors: string[] }`
  - `makeGridTexture(): THREE.CanvasTexture`, `roomMaterials(hex, repeatX, repeatZ)`
  - `buildWalls(level: Level): THREE.Group`
  - `buildScene(level: Level): { scene: THREE.Scene; interactables: THREE.Object3D[] }`

- [ ] **Step 1: Создать `src/levels/items.json`**

```json
{
  "key_brass": { "id": "key_brass", "name": "Латунный ключ", "holdable": true }
}
```

- [ ] **Step 2: Создать `src/levels/level_01.json`**

Карта вертикального среза. Геометрия проверена: комнаты не пересекаются, каждая дверь лежит на общей стене своих комнат, предмет и триггер внутри своих комнат.

```json
{
  "id": "level_01",
  "spawn": { "room": "hall", "x": 2, "z": 3, "yaw": 0 },

  "rooms": [
    { "id": "hall",       "rect": [0, 0, 8, 6],   "color": "#8b8b9f", "light": 0.9 },
    { "id": "corridor_a", "rect": [8, 2, 6, 2],   "color": "#6f746f", "light": 0.6 },
    { "id": "office",     "rect": [14, 0, 6, 6],  "color": "#8d8278", "light": 0.9 },
    { "id": "exit_hall",  "rect": [14, 6, 3, 20], "color": "#5a5a60", "light": 0.4 }
  ],

  "doors": [
    { "id": "d_hall_corr",   "between": ["hall", "corridor_a"],   "at": [8, 3] },
    { "id": "d_corr_office", "between": ["corridor_a", "office"], "at": [14, 3],
      "lock": "lock_front" },
    { "id": "d_exit",        "between": ["office", "exit_hall"],  "at": [15.5, 6],
      "sign": "EXIT" }
  ],

  "items": [
    { "def": "key_brass", "room": "hall", "at": [6, 0.9, 4.5] }
  ],

  "triggers": [
    { "id": "win", "room": "exit_hall", "rect": [14, 24, 3, 2], "effect": "win" }
  ],

  "interactions": [
    { "use": "key_brass", "on": "lock_front",
      "effects": [
        { "destroy": "lock_front" },
        { "consume": "key_brass" },
        { "say": "Замок щёлкнул и упал на пол." }
      ] }
  ]
}
```

- [ ] **Step 3: Создать `src/levels/index.ts`**

```ts
import rawLevel from './level_01.json';
import rawItems from './items.json';
import { validateLevel } from '../core/validate';
import type { ItemDef, Level } from '../core/types';

export function loadLevel(): { ok: true; level: Level } | { ok: false; errors: string[] } {
  return validateLevel(rawLevel, rawItems as unknown as Record<string, ItemDef>);
}
```

- [ ] **Step 4: Создать `src/render/materials.ts`**

```ts
import * as THREE from 'three';

/** Клетка рисуется кодом: файлов-текстур в проекте нет. */
export function makeGridTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.30)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface RoomMaterials {
  floor: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
}

/**
 * Пол темнее базового цвета комнаты, потолок светлее.
 * Разная светлота сама по себе разделяет поверхности, когда текстур нет.
 */
export function roomMaterials(
  hex: string,
  grid: THREE.CanvasTexture,
  repeatX: number,
  repeatZ: number,
): RoomMaterials {
  const base = new THREE.Color(hex);

  const floorMap = grid.clone();
  floorMap.needsUpdate = true;
  floorMap.repeat.set(repeatX, repeatZ);

  return {
    floor: new THREE.MeshStandardMaterial({
      color: base.clone().multiplyScalar(0.65),
      map: floorMap,
      roughness: 0.95,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: base.clone().lerp(new THREE.Color('#ffffff'), 0.25),
      roughness: 1,
    }),
  };
}

export const WALL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x9a9aa0,
  roughness: 0.9,
});

export const EDGE_MATERIAL = new THREE.LineBasicMaterial({ color: 0x24242a });
```

- [ ] **Step 5: Создать `src/render/walls.ts`**

Стены строятся из тех же коллайдеров, что использует физика. Один источник правды — стена и преграда не могут разъехаться.

```ts
import * as THREE from 'three';
import { DOOR, ROOM } from '../config';
import { buildColliders } from '../core/colliders';
import { roomBounds } from '../core/validate';
import type { Level } from '../core/types';
import { EDGE_MATERIAL, WALL_MATERIAL } from './materials';

function addBox(
  group: THREE.Group,
  x0: number, x1: number, z0: number, z1: number,
  yBottom: number, yTop: number,
): void {
  const geometry = new THREE.BoxGeometry(x1 - x0, yTop - yBottom, z1 - z0);
  const mesh = new THREE.Mesh(geometry, WALL_MATERIAL);
  mesh.position.set((x0 + x1) / 2, (yBottom + yTop) / 2, (z0 + z1) / 2);
  group.add(mesh);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), EDGE_MATERIAL);
  edges.position.copy(mesh.position);
  group.add(edges);
}

export function buildWalls(level: Level): THREE.Group {
  const group = new THREE.Group();

  for (const box of buildColliders(level)) {
    if (box.doorId !== undefined) continue; // створки строит doors.ts
    addBox(group, box.x0, box.x1, box.z0, box.z1, 0, ROOM.height);
  }

  // Перемычка над каждым дверным проёмом.
  const halfDoor = DOOR.width / 2;
  const halfWall = ROOM.wallThickness / 2;
  for (const door of level.doors) {
    const [dx, dz] = door.at;
    const room = level.rooms.find((r) => r.id === door.between[0]);
    if (!room) continue;
    const b = roomBounds(room);
    const onVerticalWall = Math.abs(dx - b.x0) < 1e-9 || Math.abs(dx - b.x1) < 1e-9;

    if (onVerticalWall) {
      addBox(group, dx - halfWall, dx + halfWall, dz - halfDoor, dz + halfDoor,
             DOOR.height, ROOM.height);
    } else {
      addBox(group, dx - halfDoor, dx + halfDoor, dz - halfWall, dz + halfWall,
             DOOR.height, ROOM.height);
    }
  }

  return group;
}
```

- [ ] **Step 6: Создать `src/render/scene.ts`**

```ts
import * as THREE from 'three';
import { ROOM } from '../config';
import { roomBounds } from '../core/validate';
import type { Level } from '../core/types';
import { makeGridTexture, roomMaterials } from './materials';
import { buildWalls } from './walls';

export interface SceneBuild {
  scene: THREE.Scene;
  /** Объекты, по которым бьёт луч прицела. Наполняется в задачах 10 и 11. */
  interactables: THREE.Object3D[];
}

export function buildScene(level: Level): SceneBuild {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d10);
  scene.fog = new THREE.Fog(0x0d0d10, 6, 34);

  // Полусферический свет несёт основную освещённость: у него нет затухания с
  // расстоянием, поэтому только он способен поднять дальние углы комнаты.
  scene.add(new THREE.HemisphereLight(0xdfe4ff, 0x30302f, 2.4));

  const grid = makeGridTexture();

  for (const room of level.rooms) {
    const b = roomBounds(room);
    const width = b.x1 - b.x0;
    const depth = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;

    const materials = roomMaterials(room.color, grid, width, depth);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, ROOM.height, cz);
    scene.add(ceiling);

    // Точечный источник — акцент, а не основной свет. Затухание квадратичное
    // (физически корректное с r155), поэтому яркость мала, а лампа отодвинута от
    // потолка: на 0.4 м освещённость прямо над ней была в 200 раз выше, чем в
    // дальнем углу, и потолок выжигался в белое пятно.
    const lamp = new THREE.PointLight(0xfff2dd, room.light * 2, Math.max(width, depth) * 1.6, 2);
    lamp.position.set(cx, ROOM.height - 0.75, cz);
    scene.add(lamp);
  }

  scene.add(buildWalls(level));

  return { scene, interactables: [] };
}
```

- [ ] **Step 7: Создать `src/main.ts`**

Пока камера стоит на точке появления и не двигается — движение появится в Task 9.

```ts
import * as THREE from 'three';
import { PLAYER } from './config';
import { loadLevel } from './levels';
import { buildScene } from './render/scene';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvas) throw new Error('Канвас не найден.');

const loaded = loadLevel();
if (!loaded.ok) throw new Error('Уровень не прошёл валидацию:\n' + loaded.errors.join('\n'));
const level = loaded.level;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Без тонмаппинга всё ярче единицы жёстко срезается в чистый белый, и любой
// пересвет читается плоским диском вместо мягкого блика.
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
camera.position.set(level.spawn.x, PLAYER.eyeHeight, level.spawn.z);
camera.rotation.order = 'YXZ';
camera.rotation.y = level.spawn.yaw;

const { scene } = buildScene(level);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
```

- [ ] **Step 8: Проверить глазами**

Run: `npm run dev`

Ожидается: игрок стоит в комнате `hall`, видны пол с клеткой, потолок, стены с тёмными рёбрами и дверной проём в восточной стене с перемычкой сверху. Консоль браузера чистая.

Если экран чёрный — проверить консоль: скорее всего уровень не прошёл валидацию, и сообщение об этом уже в тексте исключения.

- [ ] **Step 9: Убедиться, что ядро не потянуло за собой three.js**

Run: `grep -rn "from 'three'" src/core/ || echo "чисто"`
Expected: `чисто`.

- [ ] **Step 10: Коммит**

```bash
git add src/levels src/render src/main.ts
git commit -m "Add level data and room geometry rendering"
```

---

### Task 9: Игровой цикл, управление с клавиатуры и мыши, движение с коллизиями

**Files:**
- Create: `src/input/types.ts`, `src/input/desktop.ts`, `src/core/movement.ts`
- Test: `src/core/movement.test.ts`
- Modify: `src/main.ts` — заменить статичную камеру на игровой цикл

**Interfaces:**
- Consumes: `resolveMove` из Task 4, `activeColliders` из Task 3, `World` из Task 6, `LOOK`/`PLAYER`/`MAX_DELTA_SECONDS` из Task 1
- Produces:
  - `moveDelta(move: { x: number; y: number }, yaw: number, speed: number, dt: number): Vec2` — Task 13 зовёт её же для виртуального стика
  - `interface InputState { move: { x: number; y: number }; look: { dx: number; dy: number }; interact: boolean; toggleInventory: boolean }`
  - `interface InputSource { state: InputState; consume(): void; isLocked(): boolean }`
  - `createDesktopInput(canvas: HTMLCanvasElement): InputSource`

- [ ] **Step 1: Создать `src/input/types.ts`**

Интерфейсы лежат отдельно от `index.ts` намеренно: в Task 13 `index.ts` будет импортировать `touch.ts`, а тот — эти интерфейсы. Держи их в отдельном модуле, и циклического импорта не возникнет.

```ts
export interface InputState {
  /** Желаемое направление в осях игрока, каждая компонента в диапазоне -1..1. */
  move: { x: number; y: number };
  /** Накопленная за кадр дельта поворота. */
  look: { dx: number; dy: number };
  /** Фронт нажатия «взаимодействовать». */
  interact: boolean;
  /** Фронт нажатия «инвентарь». */
  toggleInventory: boolean;
}

export interface InputSource {
  readonly state: InputState;
  /** Сбрасывает накопленные за кадр дельты и фронты нажатий. Вызывается в конце кадра. */
  consume(): void;
  /** Захвачено ли управление. Пока не захвачено, игрок не двигается. */
  isLocked(): boolean;
}

export function emptyState(): InputState {
  return { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, interact: false, toggleInventory: false };
}
```

- [ ] **Step 2: Создать `src/input/desktop.ts`**

```ts
import { emptyState, type InputSource, type InputState } from './types';

/**
 * Все хоткеи читаются через event.code — это физическая клавиша.
 * event.key сломался бы при переключении раскладки.
 */
export function createDesktopInput(canvas: HTMLCanvasElement): InputSource {
  const state: InputState = emptyState();
  const pressed = new Set<string>();
  let locked = false;

  canvas.addEventListener('click', () => {
    // Chrome примерно 1.25 с после Escape не отдаёт захват и реджектит промис.
    // Без catch это всплывает необработанным отказом.
    if (!locked) canvas.requestPointerLock().catch(() => {});
  });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) pressed.clear();
  });

  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    state.look.dx += event.movementX;
    state.look.dy += event.movementY;
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    pressed.add(event.code);
    if (event.code === 'KeyE') state.interact = true;
    if (event.code === 'KeyI' || event.code === 'Tab') {
      state.toggleInventory = true;
      event.preventDefault(); // Tab иначе уведёт фокус со страницы
    }
  });

  window.addEventListener('keyup', (event) => pressed.delete(event.code));
  window.addEventListener('blur', () => pressed.clear());

  function axis(negative: string, positive: string): number {
    return (pressed.has(positive) ? 1 : 0) - (pressed.has(negative) ? 1 : 0);
  }

  return {
    state,
    isLocked: () => locked,
    consume() {
      state.move.x = axis('KeyA', 'KeyD');
      state.move.y = axis('KeyW', 'KeyS');
      state.look.dx = 0;
      state.look.dy = 0;
      state.interact = false;
      state.toggleInventory = false;
    },
  };
}
```

Обрати внимание: `consume` пересчитывает `move` из набора зажатых клавиш и обнуляет одноразовые сигналы. Цикл читает `state` до вызова `consume`, поэтому порядок в кадре важен: сначала обновить `move`, потом использовать, потом сбросить. Ниже это учтено.

- [ ] **Step 3: Создать `src/core/movement.ts`**

Перевод «куда нажали» в «куда сместиться» — чистая математика, и место ей в `core`,
а не внутри игрового цикла. Причина не в красоте: знак здесь легко перепутать, а
внутри `main.ts` такую ошибку ловят только ногами. Вторая причина — Task 13:
виртуальный стик даёт то же самое `move`, и конвертация должна быть одна на двоих.

```ts
import type { Vec2 } from './collision';

/**
 * Переводит намерение игрока в смещение в мире за кадр.
 *
 * `move` задан в экранных осях: x = +1 вправо (D), y = -1 вперёд (W).
 * Камера в мире смотрит в (-sin yaw, -cos yaw) — по той же оси, что и move.y,
 * поэтому знак при move.y НЕ переворачивается. Проверено против three.js.
 *
 * Диагональ нормируется: W+D даёт ровно ту же длину шага, что и один W.
 */
export function moveDelta(
  move: { x: number; y: number },
  yaw: number,
  speed: number,
  dt: number,
): Vec2 {
  const length = Math.hypot(move.x, move.y);
  if (length === 0) return { x: 0, z: 0 };
  const step = (speed * dt) / length;
  return {
    x: (Math.sin(yaw) * move.y + Math.cos(yaw) * move.x) * step,
    z: (Math.cos(yaw) * move.y - Math.sin(yaw) * move.x) * step,
  };
}
```

- [ ] **Step 4: Написать тесты `src/core/movement.test.ts` и прогнать их**

```ts
import { describe, expect, it } from 'vitest';
import { moveDelta } from './movement';

const W = { x: 0, y: -1 };
const S = { x: 0, y: 1 };
const A = { x: -1, y: 0 };
const D = { x: 1, y: 0 };

describe('moveDelta', () => {
  it('при yaw = 0 W ведёт в -Z', () => {
    const d = moveDelta(W, 0, 3, 0.1);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-0.3);
  });

  it('при yaw = 0 D ведёт в +X', () => {
    const d = moveDelta(D, 0, 3, 0.1);
    expect(d.x).toBeCloseTo(0.3);
    expect(d.z).toBeCloseTo(0);
  });

  it('поворот на 90 градусов вправо разворачивает W в +X', () => {
    const d = moveDelta(W, -Math.PI / 2, 3, 0.1);
    expect(d.x).toBeCloseTo(0.3);
    expect(d.z).toBeCloseTo(0);
  });

  it('S идёт ровно против W при произвольном yaw', () => {
    const forward = moveDelta(W, 0.7, 3, 0.1);
    const back = moveDelta(S, 0.7, 3, 0.1);
    expect(back.x).toBeCloseTo(-forward.x);
    expect(back.z).toBeCloseTo(-forward.z);
  });

  it('A идёт ровно против D при произвольном yaw', () => {
    const right = moveDelta(D, 0.7, 3, 0.1);
    const left = moveDelta(A, 0.7, 3, 0.1);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.z).toBeCloseTo(-right.z);
  });

  it('вперёд и вбок перпендикулярны', () => {
    const f = moveDelta(W, 1.1, 3, 0.1);
    const r = moveDelta(D, 1.1, 3, 0.1);
    expect(f.x * r.x + f.z * r.z).toBeCloseTo(0);
  });

  it('диагональ не быстрее прямой ходьбы', () => {
    const straight = moveDelta(W, 0.4, 3, 0.1);
    const diagonal = moveDelta({ x: 1, y: -1 }, 0.4, 3, 0.1);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(Math.hypot(straight.x, straight.z));
  });

  it('без нажатий смещения нет', () => {
    expect(moveDelta({ x: 0, y: 0 }, 1.2, 3, 0.1)).toEqual({ x: 0, z: 0 });
  });
});
```

Run: `npm test src/core/movement.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Переписать `src/main.ts` на игровой цикл**

```ts
import * as THREE from 'three';
import { LOOK, MAX_DELTA_SECONDS, PLAYER } from './config';
import { activeColliders, buildColliders } from './core/colliders';
import { resolveMove } from './core/collision';
import { moveDelta } from './core/movement';
import { World } from './core/world';
import { loadLevel } from './levels';
import { createDesktopInput } from './input/desktop';
import { buildScene } from './render/scene';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvas) throw new Error('Канвас не найден.');

const loaded = loadLevel();
if (!loaded.ok) throw new Error('Уровень не прошёл валидацию:\n' + loaded.errors.join('\n'));
const level = loaded.level;

const world = new World(level);
const allColliders = buildColliders(level);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Без тонмаппинга всё ярче единицы жёстко срезается в чистый белый, и любой
// пересвет читается плоским диском вместо мягкого блика.
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
camera.rotation.order = 'YXZ';

const { scene } = buildScene(level);

const player = { x: level.spawn.x, z: level.spawn.z };
let yaw = level.spawn.yaw;
let pitch = 0;

const input = createDesktopInput(canvas);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Возврат из фона: сбрасываем отсчёт, чтобы первый кадр не принёс многосекундный dt.
let previous = performance.now();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) previous = performance.now();
});

renderer.setAnimationLoop((now) => {
  // Клампим шаг времени: после сворачивания вкладки он приходит в секундах
  // и телепортировал бы игрока сквозь стены.
  const dt = Math.min((now - previous) / 1000, MAX_DELTA_SECONDS);
  previous = now;

  const state = input.state;

  if (input.isLocked()) {
    yaw -= state.look.dx * LOOK.sensitivity;
    pitch -= state.look.dy * LOOK.sensitivity;
    pitch = Math.max(-LOOK.maxPitch, Math.min(LOOK.maxPitch, pitch));

    const delta = moveDelta(state.move, yaw, PLAYER.speed, dt);
    if (delta.x !== 0 || delta.z !== 0) {
      const boxes = activeColliders(allColliders, world.openDoors());
      const next = resolveMove(player, delta, PLAYER.radius, boxes);
      player.x = next.x;
      player.z = next.z;
    }

    world.checkTriggers(player.x, player.z);
  }

  camera.position.set(player.x, PLAYER.eyeHeight, player.z);
  camera.rotation.set(pitch, yaw, 0);

  renderer.render(scene, camera);
  input.consume();
});
```

- [ ] **Step 6: Проверить глазами и ногами**

Run: `npm run dev`

Проверить по списку:
1. Клик по экрану захватывает курсор, мышь вращает камеру, взгляд не переворачивается при попытке посмотреть выше вертикали.
2. `W` идёт вперёд туда, куда смотришь; `A` и `D` дают шаг вбок; `S` назад.
3. Диагональ (`W`+`D`) не быстрее прямой ходьбы.
4. В стену пройти нельзя, при движении под углом игрок скользит вдоль неё.
5. В дверных проёмах игрок упирается в невидимую преграду — это ОЖИДАЕМО.
   Коллайдер закрытой створки существует с Task 3, а меш створки появится только
   в Task 10 вместе с открыванием по `E`. То есть до Task 10 уровень проходим
   только в пределах стартовой комнаты, и проверять надо там.
6. `Escape` отпускает курсор, движение останавливается.
7. Свернуть вкладку на десять секунд, вернуться — игрока не выбросило сквозь стены и не дёрнуло вперёд.

- [ ] **Step 7: Коммит**

```bash
git add src/input src/core/movement.ts src/core/movement.test.ts src/main.ts
git commit -m "Add game loop with keyboard and mouse controls"
```

---

### Task 10: Прицел, подсказки, двери и замки

**Files:**
- Create: `src/render/doors.ts`, `src/ui/hud.ts`
- Modify: `src/core/validate.ts` — вынести определение ориентации двери
- Modify: `src/core/colliders.ts` — начать пользоваться вынесенным
- Test: `src/core/validate.test.ts`
- Modify: `index.html` — добавить разметку HUD
- Modify: `src/render/scene.ts` — добавить створки и замки в сцену и в список целей
- Modify: `src/main.ts` — луч прицела и обработка взаимодействия

**Interfaces:**
- Consumes: `World.describe`/`World.interact` из Task 7, `INTERACT_RANGE` из Task 1
- Produces:
  - `buildDoors(level, world): { group: THREE.Group; targets: THREE.Object3D[]; update(dt: number, player: Vec2): void }`
  - `createHud(): { setPrompt(text: string | null): void; setRefusal(text: string | null): void; flash(text: string): void }`
  - Соглашение: у каждого меша-цели в `userData.targetId` лежит идентификатор для `World.describe`

- [ ] **Step 1: Добавить разметку HUD в `index.html`**

Вставить внутрь `<body>` сразу после `<canvas>`:

```html
    <div id="hud">
      <div id="reticle"></div>
      <div id="prompt"></div>
    </div>
```

И дописать в блок `<style>`:

```css
      #hud { position: fixed; inset: 0; pointer-events: none;
             font: 16px/1.4 system-ui, sans-serif; color: #f2f2f2; }
      #reticle { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px;
                 margin: -3px 0 0 -3px; border-radius: 50%;
                 background: rgba(255,255,255,0.75);
                 transition: transform 0.1s, background 0.1s; }
      #reticle.active { transform: scale(1.9); background: #ffd479; }
      #prompt { position: absolute; left: 50%; top: calc(50% + 28px);
                transform: translateX(-50%); padding: 6px 12px; border-radius: 6px;
                background: rgba(0,0,0,0.55); white-space: nowrap; opacity: 0;
                transition: opacity 0.12s; }
      #prompt.visible { opacity: 1; }
      #prompt.refusal { background: rgba(90,20,20,0.7); }
```

- [ ] **Step 2: Создать `src/ui/hud.ts`**

```ts
export interface Hud {
  /** Подсказка о доступном действии. `null` прячет строку. */
  setPrompt(text: string | null): void;
  /** Причина отказа: та же строка, но другим фоном. */
  setRefusal(text: string | null): void;
  /** Короткое сообщение поверх, например текст эффекта say. */
  flash(text: string): void;
}

export function createHud(): Hud {
  const reticle = document.querySelector<HTMLElement>('#reticle');
  const prompt = document.querySelector<HTMLElement>('#prompt');
  if (!reticle || !prompt) throw new Error('Разметка HUD не найдена.');

  let flashUntil = 0;

  // `!` здесь обязателен: TypeScript сбрасывает сужение типа на объявлении функции,
  // потому что оно поднимается и компилятор не знает, что вызов будет после проверки.
  // На стрелке в `const` сужение сохранилось бы, но читаемость от этого не выигрывает.
  function writePrompt(text: string | null, refusal: boolean): void {
    prompt!.textContent = text ?? '';
    prompt!.classList.toggle('visible', text !== null);
    prompt!.classList.toggle('refusal', refusal);
  }

  /**
   * Прицел отражает то, на что игрок наведён ПРЯМО СЕЙЧАС, и тост его не трогает:
   * иначе любое сообщение `say` красило бы прицел активным жёлтым посреди пустой
   * комнаты и на две секунды прятало бы настоящий отказ.
   */
  function aim(text: string | null, refusal: boolean): void {
    reticle!.classList.toggle('active', text !== null && !refusal);
    if (performance.now() < flashUntil) return;
    writePrompt(text, refusal);
  }

  return {
    setPrompt: (text) => aim(text, false),
    setRefusal: (text) => aim(text, true),
    flash(text) {
      writePrompt(text, false);
      flashUntil = performance.now() + 2200;
    },
  };
}
```

- [ ] **Step 3: Вынести ориентацию двери в `src/core/validate.ts`**

От одного и того же факта — вдоль какой оси идёт стена с проёмом — зависят и
коллайдер двери, и её полотно. Считать его в двух файлах порознь нельзя: разъедутся
— игрок будет видеть одно, а упираться в другое, и поймает это только глаз. В
`render/` тестов нет, так что больше поймать некому.

Дописать в `src/core/validate.ts` сразу после объявления `EPS`:

```ts
/**
 * Прорезан ли проём в стене, идущей вдоль оси Z (то есть на границе по X).
 *
 * Единственное место, где этот факт вычисляется. От него зависят и коллайдер
 * двери (`core/colliders.ts`), и её полотно с петлёй (`render/doors.ts`).
 */
export function doorOnVerticalWall(door: DoorDef, room: RoomDef): boolean {
  const b = roomBounds(room);
  const [dx] = door.at;
  return Math.abs(dx - b.x0) < EPS || Math.abs(dx - b.x1) < EPS;
}
```

В `src/core/colliders.ts` добавить импорт и заменить вычисление на вызов:

```ts
import { doorOnVerticalWall, roomBounds } from './validate';
```

```ts
  const room = level.rooms.find((r) => r.id === door.between[0])!;
  const onVerticalWall = doorOnVerticalWall(door, room);
```

(строка `const b = roomBounds(room);` в `doorCollider` больше не нужна — она была
нужна только ради этой проверки.)

- [ ] **Step 4: Дописать тест в `src/core/validate.test.ts` и прогнать**

```ts
describe('doorOnVerticalWall', () => {
  const hall = { id: 'hall', rect: [0, 0, 8, 6], color: '#888', light: 1 } as RoomDef;

  it('дверь на восточной стене комнаты лежит на вертикальной стене', () => {
    const door = { id: 'd', between: ['hall', 'other'], at: [8, 3] } as DoorDef;
    expect(doorOnVerticalWall(door, hall)).toBe(true);
  });

  it('дверь на западной стене тоже', () => {
    const door = { id: 'd', between: ['hall', 'other'], at: [0, 3] } as DoorDef;
    expect(doorOnVerticalWall(door, hall)).toBe(true);
  });

  it('дверь на южной стене лежит на горизонтальной', () => {
    const door = { id: 'd', between: ['hall', 'other'], at: [4, 6] } as DoorDef;
    expect(doorOnVerticalWall(door, hall)).toBe(false);
  });
});
```

Импорты в шапке файла дополнить `doorOnVerticalWall`, а типы — `DoorDef`, `RoomDef`,
если их там ещё нет.

Run: `npm test src/core/validate.test.ts`
Expected: все зелёные, включая три новых.

- [ ] **Step 5: Создать `src/render/doors.ts`**

```ts
import * as THREE from 'three';
import { DOOR } from '../config';
import { doorOnVerticalWall } from '../core/validate';
import type { Vec2 } from '../core/collision';
import type { Level } from '../core/types';
import type { World } from '../core/world';

const LEAF_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x6b533c, roughness: 0.85 });
const LOCK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xb8a03a, roughness: 0.4, metalness: 0.6,
});
// Размеры одинаковы у всех дверей и всех замков, поэтому геометрия общая — как
// и материалы выше. Из-за этого её нельзя освобождать при уничтожении одной цели.
const LEAF_GEOMETRY = new THREE.BoxGeometry(DOOR.width, DOOR.height, 0.06);
const LOCK_GEOMETRY = new THREE.BoxGeometry(0.14, 0.2, 0.08);

interface Leaf {
  pivot: THREE.Group;
  /** Стена стоит поперёк оси X. От этого зависит знак четверти оборота. */
  onVerticalWall: boolean;
  at: Vec2;
  closedAngle: number;
  openAngle: number;
  progress: number; // 0 закрыта, 1 открыта
  target: number;
}

export interface Doors {
  group: THREE.Group;
  targets: THREE.Object3D[];
  update(dt: number, player: Vec2): void;
}

/**
 * Куда распахнуть створку, чтобы она ушла ОТ игрока, а не ему в лицо (спека §9).
 *
 * Поворот на +π/2 переводит направление полотна +Z → +X → -Z → -X. Закрытая
 * створка на вертикальной стене смотрит в +Z, на горизонтальной — в +X, поэтому
 * знак четверти оборота у этих двух случаев противоположный. Проверено на three.js.
 */
function openAngleAwayFrom(leaf: Leaf, player: Vec2): number {
  const quarter = Math.PI / 2;
  return leaf.onVerticalWall
    ? leaf.closedAngle + (player.x < leaf.at.x ? quarter : -quarter)
    : leaf.closedAngle + (player.z < leaf.at.z ? -quarter : quarter);
}

export function buildDoors(level: Level, world: World): Doors {
  const group = new THREE.Group();
  const targets: THREE.Object3D[] = [];
  const leaves = new Map<string, Leaf>();

  for (const door of level.doors) {
    const [dx, dz] = door.at;
    const room = level.rooms.find((r) => r.id === door.between[0]);
    if (!room) continue;
    const onVerticalWall = doorOnVerticalWall(door, room);

    // Петля у одного края проёма, полотно уходит от неё.
    const pivot = new THREE.Group();
    pivot.position.set(
      onVerticalWall ? dx : dx - DOOR.width / 2,
      0,
      onVerticalWall ? dz - DOOR.width / 2 : dz,
    );
    // Поворот на θ кладёт локальный +X в мировой (cos θ, -sin θ). Полотно обязано
    // заполнить проём: на вертикальной стене — уйти в +Z, а это θ = -π/2.
    // При +π/2 створка встаёт на целую ширину двери мимо проёма. Проверено числами.
    const closedAngle = onVerticalWall ? -Math.PI / 2 : 0;
    pivot.rotation.y = closedAngle;

    const leaf = new THREE.Mesh(LEAF_GEOMETRY, LEAF_MATERIAL);
    leaf.position.set(DOOR.width / 2, DOOR.height / 2, 0);
    leaf.userData['targetId'] = door.id;
    pivot.add(leaf);
    targets.push(leaf);

    group.add(pivot);
    leaves.set(door.id, {
      pivot,
      onVerticalWall,
      at: { x: dx, z: dz },
      closedAngle,
      openAngle: closedAngle, // настоящий угол считается в момент открывания
      progress: 0,
      target: 0,
    });

    if (door.lock) {
      const lock = new THREE.Mesh(LOCK_GEOMETRY, LOCK_MATERIAL);
      lock.position.set(DOOR.width * 0.82, 1.15, 0.07);
      lock.userData['targetId'] = door.lock;
      pivot.add(lock);
      targets.push(lock);
    }
  }

  world.on((event) => {
    if (event.kind === 'doorOpened') {
      const leaf = leaves.get(event.door);
      if (leaf) leaf.target = 1;
    }
    if (event.kind === 'doorClosed') {
      const leaf = leaves.get(event.door);
      if (leaf) leaf.target = 0;
    }
    // Уничтожение цели обрабатывает scene.ts: правило одно для замков и предметов.
  });

  return {
    group,
    targets,
    update(dt, player) {
      for (const leaf of leaves.values()) {
        // Сторону выбираем в момент начала хода: только тогда известно, где игрок.
        if (leaf.target === 1 && leaf.progress === 0) {
          leaf.openAngle = openAngleAwayFrom(leaf, player);
        }
        if (leaf.progress === leaf.target) continue;
        const step = dt / DOOR.openSeconds;
        leaf.progress = leaf.target > leaf.progress
          ? Math.min(leaf.target, leaf.progress + step)
          : Math.max(leaf.target, leaf.progress - step);
        // Плавное замедление к концу хода.
        const eased = leaf.progress * leaf.progress * (3 - 2 * leaf.progress);
        leaf.pivot.rotation.y = leaf.closedAngle + (leaf.openAngle - leaf.closedAngle) * eased;
      }
    },
  };
}
```

- [ ] **Step 6: Подключить двери в `src/render/scene.ts`**

Изменить сигнатуру и тело:

```ts
export function buildScene(level: Level, world: World): SceneBuild {
```

добавить импорты:

```ts
import { buildDoors, type Doors } from './doors';
import type { World } from '../core/world';
```

расширить возвращаемый тип:

```ts
export interface SceneBuild {
  scene: THREE.Scene;
  /**
   * Живой список целей луча. Уничтоженная цель удаляется отсюда, а не только
   * из сцены. Задача 11 дописывает сюда предметы.
   */
  interactables: THREE.Object3D[];
  doors: Doors;
}
```

и в конце функции заменить `return`:

```ts
  scene.add(buildWalls(level));

  const doors = buildDoors(level, world);
  scene.add(doors.group);

  const interactables: THREE.Object3D[] = [...doors.targets];

  // Убрать меш из сцены мало. Raycaster не смотрит ни на `visible`, ни на родителя —
  // только на слои, — и продолжил бы бить по последней мировой матрице удалённого
  // объекта. Замок висит ближе полотна, а `classify` для уничтоженного возвращает
  // null, так что отпертая дверь навсегда отвечала бы «здесь не с чем
  // взаимодействовать» и больше не открывалась. Список целей ведём здесь, чтобы
  // правило было одно и для замков, и для предметов из задачи 11.
  world.on((event) => {
    if (event.kind !== 'objectDestroyed') return;
    const index = interactables.findIndex((t) => t.userData['targetId'] === event.object);
    if (index === -1) return;
    interactables[index]?.removeFromParent();
    interactables.splice(index, 1);
  });

  return { scene, interactables, doors };
```

- [ ] **Step 7: Добавить луч прицела и взаимодействие в `src/main.ts`**

Добавить импорты:

```ts
import { INTERACT_RANGE } from './config';
import { createHud } from './ui/hud';
```

После создания сцены заменить строку получения сцены на:

```ts
const { scene, interactables, doors } = buildScene(level, world);
const hud = createHud();
const raycaster = new THREE.Raycaster();
raycaster.far = INTERACT_RANGE;
/** Центр экрана. Вынесен из цикла: в кадре нельзя мусорить аллокациями. */
const SCREEN_CENTER = new THREE.Vector2(0, 0);

world.on((event) => {
  if (event.kind === 'said') hud.flash(event.text);
});
```

И внутри цикла, перед `renderer.render`, вставить:

```ts
  doors.update(dt, player);

  // Матрицы обновляются внутри render, то есть уже после этого места. Без явного
  // обновления луч бил бы туда, куда игрок смотрел кадр назад, и по створке в том
  // положении, в котором она была кадр назад.
  camera.updateMatrixWorld();
  doors.group.updateMatrixWorld(true);

  raycaster.setFromCamera(SCREEN_CENTER, camera);
  const hit = raycaster.intersectObjects(interactables, false)[0];
  const targetId = hit?.object.userData['targetId'] as string | undefined;

  if (targetId === undefined) {
    hud.setPrompt(null);
  } else {
    const outcome = world.describe(targetId);
    if (outcome.ok) hud.setPrompt(outcome.prompt);
    else hud.setRefusal(outcome.refusal);

    if (state.interact && input.isLocked()) world.interact(targetId);
  }
```

Блок ставится после строк `camera.position.set(...)` и `camera.rotation.set(...)`
и перед `renderer.render(...)`.

- [ ] **Step 8: Проверить глазами**

Run: `npm run dev`

Проверить по списку:
1. При наведении на дверь `d_hall_corr` прицел становится жёлтым и появляется «Открыть дверь».
2. `E` открывает створку с плавной анимацией примерно за 0.4 с, дверь распахивается от игрока.
3. В открытый проём можно пройти; закрытая створка не пускает.
4. На двери `d_corr_office` виден жёлтый замок, подсказка на самой двери — «Заперто. На двери висит замок.» с красноватым фоном.
5. Наведение на замок без предмета в руках даёт «Замок заперт. Нужно чем-то открыть.»
6. Подсказка исчезает, когда отходишь дальше 2.5 м.
7. Замок на `d_corr_office` видно и достаёт луч со стороны коридора, а не только
   изнутри офиса: подходить к нему игрок будет именно оттуда.

- [ ] **Step 9: Коммит**

```bash
git add index.html src/core/validate.ts src/core/validate.test.ts src/core/colliders.ts \
  src/render/doors.ts src/render/scene.ts src/ui/hud.ts src/main.ts
git commit -m "Add reticle targeting, prompts, animated doors and locks"
```

---

### Task 11: Предметы в мире, инвентарь и предмет в руках

После этой задачи проходится вся основная петля: увидел ключ, подобрал, открыл инвентарь, взял в руки, открыл замок.

**Files:**
- Create: `src/render/items.ts`, `src/render/hand.ts`, `src/ui/inventory.ts`
- Modify: `index.html` — оверлей инвентаря
- Modify: `src/render/scene.ts` — добавить предметы в сцену и в список целей
- Modify: `src/main.ts` — пауза на открытом инвентаре, отрисовка руки

**Interfaces:**
- Consumes: `World` из Task 6 и 7, `ItemDef` из Task 2
- Produces:
  - `buildItems(level): { group: THREE.Group; targets: THREE.Object3D[] }`
  - `createHand(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; setItem(id: string | null): void }`
  - `createInventoryUi(world): { isOpen(): boolean; toggle(): void; close(): void }`

- [ ] **Step 1: Создать `src/render/items.ts`**

```ts
import * as THREE from 'three';
import type { Level } from '../core/types';

const ITEM_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xd9b64a, roughness: 0.35, metalness: 0.7,
});

/**
 * Форма предмета в мире. Моделей нет, поэтому все предметы — небольшие бруски.
 * Геометрия общая на все предметы и на руку, поэтому её нельзя освобождать
 * при исчезновении одного предмета.
 */
export const ITEM_GEOMETRY = new THREE.BoxGeometry(0.09, 0.03, 0.22);

export function buildItems(level: Level): {
  group: THREE.Group;
  targets: THREE.Object3D[];
} {
  const group = new THREE.Group();
  const targets: THREE.Object3D[] = [];

  for (const placement of level.items) {
    const mesh = new THREE.Mesh(ITEM_GEOMETRY, ITEM_MATERIAL);
    mesh.position.set(placement.at[0], placement.at[1], placement.at[2]);
    mesh.userData['targetId'] = placement.def;
    group.add(mesh);
    targets.push(mesh);
  }

  // Убирает подобранный предмет из сцены НЕ этот модуль, а scene.ts: он же ведёт
  // список целей луча, и снять меш нужно из обоих мест одновременно.
  return { group, targets };
}
```

- [ ] **Step 2: Создать `src/render/hand.ts`**

Отдельная камера с маленьким `near` — иначе предмет протыкает стены при подходе вплотную.

```ts
import * as THREE from 'three';
import { ITEM_GEOMETRY } from './items';

const HELD_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xe8c65a, roughness: 0.3, metalness: 0.7,
});

export interface Hand {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setItem(id: string | null): void;
  resize(aspect: number): void;
}

export function createHand(): Hand {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));

  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 2);
  camera.position.set(0, 0, 0);

  const mesh = new THREE.Mesh(ITEM_GEOMETRY, HELD_MATERIAL);
  mesh.position.set(0.24, -0.19, -0.5);
  mesh.rotation.set(0.2, -0.5, 0.35);
  mesh.visible = false;
  scene.add(mesh);

  return {
    scene,
    camera,
    setItem(id) { mesh.visible = id !== null; },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); },
  };
}
```

- [ ] **Step 3: Добавить оверлей инвентаря в `index.html`**

Вставить после блока `#hud`:

```html
    <div id="inventory" hidden>
      <h2>Инвентарь</h2>
      <ul id="inventory-list"></ul>
      <p id="inventory-empty">Пусто.</p>
      <p class="hint">I или Tab — закрыть</p>
    </div>
```

И дописать в `<style>`:

```css
      #inventory { position: fixed; inset: 0; display: flex; flex-direction: column;
                   align-items: center; justify-content: center; gap: 10px;
                   background: rgba(10,10,14,0.86); color: #f2f2f2;
                   font: 18px/1.5 system-ui, sans-serif; z-index: 10; }
      #inventory[hidden] { display: none; }
      #inventory h2 { margin: 0 0 6px; font-size: 22px; font-weight: 600; }
      #inventory ul { list-style: none; margin: 0; padding: 0; width: min(420px, 84vw); }
      #inventory li { padding: 14px 16px; margin-bottom: 8px; border-radius: 8px;
                      background: rgba(255,255,255,0.09); cursor: pointer;
                      min-height: 48px; box-sizing: border-box; }
      #inventory li.held { background: rgba(255,212,121,0.22); outline: 2px solid #ffd479; }
      #inventory .hint { opacity: 0.55; font-size: 14px; }
```

- [ ] **Step 4: Создать `src/ui/inventory.ts`**

```ts
import type { World } from '../core/world';

export interface InventoryUi {
  isOpen(): boolean;
  toggle(): void;
  close(): void;
}

export function createInventoryUi(world: World): InventoryUi {
  const root = document.querySelector<HTMLElement>('#inventory');
  const list = document.querySelector<HTMLUListElement>('#inventory-list');
  const empty = document.querySelector<HTMLElement>('#inventory-empty');
  if (!root || !list || !empty) throw new Error('Разметка инвентаря не найдена.');

  function render(): void {
    const items = world.inventory();
    const held = world.held();

    list!.replaceChildren();
    for (const id of items) {
      const entry = document.createElement('li');
      entry.textContent = world.level.itemDefs[id]?.name ?? id;
      // render вручную звать не надо: setHeld эмитит handChanged, а на него
      // подписан этот же render. Иначе список перерисуется дважды, причём второй
      // раз — из обработчика на строке, которую первая перерисовка уже выбросила.
      entry.addEventListener('click', () => world.setHeld(id));
      list!.append(entry);
    }

    // Предмет в руках в world.inventory() не попадает: setHeld переводит его
    // в 'hand', а inventoryItems отдаёт только 'inventory'. Поэтому он не
    // подсвечивается в списке, а дописывается отдельной строкой.
    if (held !== null) {
      const entry = document.createElement('li');
      entry.textContent = `${world.level.itemDefs[held]?.name ?? held} (в руках)`;
      entry.classList.add('held');
      entry.addEventListener('click', () => world.setHeld(null));
      list!.append(entry);
    }

    empty!.hidden = items.length > 0 || held !== null;
  }

  world.on((event) => {
    if (event.kind === 'itemTaken' || event.kind === 'itemGone' || event.kind === 'handChanged') {
      if (!root!.hidden) render();
    }
  });

  return {
    isOpen: () => !root.hidden,
    toggle() {
      root.hidden = !root.hidden;
      if (!root.hidden) render();
    },
    close() { root.hidden = true; },
  };
}
```

- [ ] **Step 5: Подключить предметы в `src/render/scene.ts`**

**Внимание.** Живой список `interactables` и подписка, которая из него вычищает,
уже есть в файле после задачи 10. Их надо ДОПОЛНИТЬ, а не заменить. Если вернуть
на их место `return { scene, interactables: [...], doors }` со свежим массивом,
вернётся дефект, ради которого задача 10 гоняла раунд правок: отпертый замок
навсегда перехватывал бы луч, и дверь больше не открылась бы. Именно эта задача
делает тот путь достижимым, так что поломка была бы не теоретической.

Добавить импорт `import { buildItems } from './items';`.

Строку создания предметов вставить сразу после дверей:

```ts
  const items = buildItems(level);
  scene.add(items.group);
```

Начальное наполнение списка дополнить предметами:

```ts
  const interactables: THREE.Object3D[] = [...doors.targets, ...items.targets];
```

А существующую подписку расширить: подобранный предмет обязан исчезать из списка
целей ровно так же, как уничтоженный замок. Иначе после подбора ключа луч
продолжал бы находить его на полу и отвечать отказом.

```ts
  world.on((event) => {
    let gone: string | null = null;
    if (event.kind === 'objectDestroyed') gone = event.object;
    if (event.kind === 'itemTaken' || event.kind === 'itemGone') gone = event.item;
    if (gone === null) return;
    const index = interactables.findIndex((t) => t.userData['targetId'] === gone);
    if (index === -1) return;
    interactables[index]?.removeFromParent();
    interactables.splice(index, 1);
  });
```

`return { scene, interactables, doors };` остаётся как есть.

- [ ] **Step 6: Подключить руку и паузу в `src/main.ts`**

Добавить импорты:

```ts
import { createHand } from './render/hand';
import { createInventoryUi } from './ui/inventory';
```

После создания `hud`:

```ts
const hand = createHand();
const inventoryUi = createInventoryUi(world);

world.on((event) => {
  if (event.kind === 'handChanged') hand.setItem(event.item);
});
```

Дописать в функцию `resize` перед закрывающей скобкой:

```ts
  hand.resize(width / height);
```

Внутри цикла сразу после строки `const state = input.state;` (раньше нельзя —
`state` там ещё не объявлена):

```ts
  if (state.toggleInventory) {
    inventoryUi.toggle();
    if (inventoryUi.isOpen() && document.pointerLockElement) document.exitPointerLock();
  }
  const paused = inventoryUi.isOpen();
```

Условие движения поменять с `if (input.isLocked())` на `if (input.isLocked() && !paused)`, а блок отрисовки — на:

```ts
  renderer.autoClear = true;
  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(hand.scene, hand.camera);
  input.consume();
```

Также спрятать подсказку на паузе: обернуть блок с лучом прицела в `if (!paused) { ... } else { hud.setPrompt(null); }`.

- [ ] **Step 7: Проверить глазами**

Run: `npm run dev`

Проверить по списку:
1. В `hall` на полу лежит золотистый ключ, подсказка «Подобрать: Латунный ключ».
2. `E` подбирает его, меш исчезает — и наведение на то место, где он лежал,
   больше не даёт никакой подсказки, даже отказа.
3. `I` открывает инвентарь, игра встаёт на паузу, курсор освобождается, мышь больше не крутит камеру.
4. Клик по строке берёт ключ в руки: строка подсвечивается, в правом нижнем углу появляется предмет.
5. `I` закрывает инвентарь, клик по экрану возвращает захват курсора.
6. Подойти вплотную к стене — предмет в руках её не протыкает.
7. Навести ключ на замок двери `d_corr_office`: подсказка «Использовать: Латунный ключ», `E` уничтожает замок, всплывает «Замок щёлкнул и упал на пол.», ключ исчезает из инвентаря.
8. Дверь после этого открывается по `E`.
9. `Tab` работает как `I` и не уводит фокус со страницы.

- [ ] **Step 8: Коммит**

```bash
git add index.html src/render/items.ts src/render/hand.ts src/render/scene.ts src/ui/inventory.ts src/main.ts
git commit -m "Add world items, inventory overlay and held item rendering"
```

---

### Task 12: Табличка EXIT, финальный коридор и победа

**Files:**
- Create: `src/render/sign.ts`
- Modify: `index.html` — оверлей засветки и экран победы
- Modify: `src/render/scene.ts` — таблички и белый торец коридора
- Modify: `src/main.ts` — нарастание засветки и экран победы

**Interfaces:**
- Consumes: `Level`, `roomBounds`, событие `won` из Task 6
- Produces:
  - `makeSignTexture(text: string): THREE.CanvasTexture`
  - `buildSigns(level: Level): THREE.Group`
  - `buildExitGlow(level: Level): THREE.Group`

- [ ] **Step 1: Создать `src/render/sign.ts`**

```ts
import * as THREE from 'three';
import { DOOR, ROOM } from '../config';
import { doorOnVerticalWall, roomBounds } from '../core/validate';
import type { Level } from '../core/types';

/** Текст рисуется на канвасе: файлов-текстур в проекте нет. */
export function makeSignTexture(text: string): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен.');

  ctx.fillStyle = '#0a1a0d';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#7dff9b';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildSigns(level: Level): THREE.Group {
  const group = new THREE.Group();

  for (const door of level.doors) {
    if (!door.sign) continue;

    const [dx, dz] = door.at;
    // Табличка вешается со стороны комнаты `between[0]` — той, ИЗ которой в дверь
    // входят. Сторону нельзя зашивать константой: PlaneGeometry односторонняя, и
    // повешенная не с той стороны табличка уедет внутрь стены и отвернётся от игрока.
    const room = level.rooms.find((r) => r.id === door.between[0]);
    if (!room) continue;
    const b = roomBounds(room);

    // MeshBasicMaterial не зависит от освещения: табличка останется яркой,
    // когда в комплексе позже выключат свет.
    const material = new THREE.MeshBasicMaterial({ map: makeSignTexture(door.sign) });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), material);

    const y = DOOR.height + (ROOM.height - DOOR.height) / 2;
    const offset = ROOM.wallThickness / 2 + 0.02;

    // Нормаль таблички смотрит в комнату. Проём лежит на той границе комнаты,
    // к которой он ближе, и с этой стороны стены нужная нам сторона — внутренняя.
    const normal = doorOnVerticalWall(door, room)
      ? new THREE.Vector3(Math.abs(dx - b.x1) < Math.abs(dx - b.x0) ? -1 : 1, 0, 0)
      : new THREE.Vector3(0, 0, Math.abs(dz - b.z1) < Math.abs(dz - b.z0) ? -1 : 1);
    plate.rotation.y = Math.atan2(normal.x, normal.z);
    plate.position.set(dx, y, dz).addScaledVector(normal, offset);

    group.add(plate);

    // Лампа отодвинута от стены, а не посажена на саму табличку. Затухание
    // физически корректное (decay 2), поэтому источник на 0.12 м от стены дал бы
    // освещённость около 3 / 0.12² ≈ 200 и стена вокруг таблички превратилась бы
    // в плоское белое пятно — ровно то, что уже случилось с потолком в задаче 8.
    // Здесь 0.5 / 0.62² ≈ 1.3: ореол заметен, пересвета нет.
    const glow = new THREE.PointLight(0x7dff9b, 0.5, 3, 2);
    glow.position.copy(plate.position).addScaledVector(normal, 0.5);
    group.add(glow);
  }

  return group;
}

/**
 * Белая стена и сильный свет в дальнем торце финального коридора.
 *
 * Допущение: коридор идёт вдоль +Z, а дальний торец — у `z1`. В уровне 1 так и
 * есть (`exit_hall` тянется с z=6 до z=26, игрок входит со стороны z=6). Обобщать
 * на четыре ориентации незачем: выходной коридор в игре один, а ошибка была бы
 * видна сразу — белая стена оказалась бы за спиной.
 */
export function buildExitGlow(level: Level): THREE.Group {
  const group = new THREE.Group();

  for (const trigger of level.triggers) {
    if (trigger.effect !== 'win') continue;
    const room = level.rooms.find((r) => r.id === trigger.room);
    if (!room) continue;
    const b = roomBounds(room);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(b.x1 - b.x0, ROOM.height),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    // Стены строятся ВНУТРЬ комнаты (см. colliders.ts), поэтому дальняя стена
    // занимает z от z1 - 0.2 до z1, а её обращённая к игроку грань — на z1 - 0.2.
    // Плоскость на z1 - 0.05 оказалась бы ВНУТРИ этого непрозрачного бокса и не
    // рисовалась бы вовсе: торец «светился» бы только за счёт пересвета серой
    // стены лампой, то есть случайно.
    wall.position.set((b.x0 + b.x1) / 2, ROOM.height / 2, b.z1 - ROOM.wallThickness - 0.05);
    wall.rotation.y = Math.PI;
    group.add(wall);

    const light = new THREE.PointLight(0xffffff, 40, 16, 2);
    light.position.set((b.x0 + b.x1) / 2, ROOM.height / 2, b.z1 - 1.2);
    group.add(light);
  }

  return group;
}
```

- [ ] **Step 2: Добавить оверлеи в `index.html`**

Вставить после блока `#inventory`:

```html
    <div id="flash"></div>
    <div id="win" hidden><p>Ты выбрался.</p></div>
```

И в `<style>`:

```css
      /* Ниже инвентаря (z-index 10), но выше HUD: засветка — эффект мира,
         а инвентарь поверх неё остаётся читаемым. Экран победы выше всех. */
      #flash { position: fixed; inset: 0; background: #ffffff; opacity: 0;
               pointer-events: none; z-index: 5; }
      #win { position: fixed; inset: 0; display: flex; align-items: center;
             justify-content: center; z-index: 21; color: #1a1a1a;
             font: 600 32px/1.4 system-ui, sans-serif; }
      #win[hidden] { display: none; }
```

- [ ] **Step 3: Подключить таблички и торец в `src/render/scene.ts`**

Добавить импорт `import { buildExitGlow, buildSigns } from './sign';` и перед `return`:

```ts
  scene.add(buildSigns(level));
  scene.add(buildExitGlow(level));
```

- [ ] **Step 4: Добавить засветку и победу в `src/main.ts`**

Добавить после создания `inventoryUi`:

```ts
const flashEl = document.querySelector<HTMLElement>('#flash');
const winEl = document.querySelector<HTMLElement>('#win');
if (!flashEl || !winEl) throw new Error('Разметка финала не найдена.');

const winTrigger = level.triggers.find((t) => t.effect === 'win');

world.on((event) => {
  if (event.kind === 'won') {
    if (document.pointerLockElement) document.exitPointerLock();
    winEl.hidden = false;
  }
});
```

И внутри цикла перед отрисовкой:

```ts
  // Тот же белый оверлей служит и засветкой на подходе, и экраном победы.
  if (winTrigger) {
    const [tx, tz, tw, td] = winTrigger.rect;
    const cx = tx + tw / 2;
    const cz = tz + td / 2;
    const distance = Math.hypot(player.x - cx, player.z - cz);
    const glow = Math.max(0, Math.min(1, (10 - distance) / 9));
    flashEl.style.opacity = String(world.won ? 1 : glow * 0.9);
  }
```

- [ ] **Step 5: Убрать последнюю копию `onVerticalWall` из `src/render/walls.ts`**

Задача 10 вынесла эту формулу в `doorOnVerticalWall`, но копию в `walls.ts` тогда
не заметили ни ревью, ни план. Это тот же риск: перемычка над проёмом встала бы не
на ту стену, если вычисления разойдутся.

Заменить импорт:

```ts
import { doorOnVerticalWall, roomBounds } from '../core/validate';
```

И в цикле по дверям убрать локальное вычисление, заменив на вызов:

```ts
    const room = level.rooms.find((r) => r.id === door.between[0]);
    if (!room) continue;
    const b = roomBounds(room);

    if (doorOnVerticalWall(door, room)) {
```

Переменная `b` в этом цикле остаётся: она больше не нужна для проверки стены,
но `roomBounds` здесь всё ещё зовётся ради неё — если после правки `b` окажется
неиспользованной, убери и её, и `roomBounds` из импорта, иначе `noUnusedLocals`
уронит сборку.

Геометрия обязана остаться прежней. Проверь это численно: число боксов и их
координаты из `buildWalls(level_01)` до и после правки должны совпасть.

- [ ] **Step 6: Проверить глазами**

Run: `npm run dev`

Проверить по списку:
1. Над дверью `d_exit` в комнате `office` видна светящаяся зелёная табличка EXIT, заметная от входа в комнату.
2. Табличка подсвечивает стену вокруг себя мягким ореолом. Если вместо ореола
   видно плоское белое пятно без градиента — лампа снова слишком близко к стене,
   это та же ошибка, что была с потолком в задаче 8.
3. За дверью EXIT — длинный коридор, в дальнем конце белое пятно света.
4. По мере приближения к концу коридора экран плавно заливается белым.
5. При входе в триггер экран становится полностью белым и появляется «Ты выбрался.», курсор освобождается.
6. Пройти игру целиком от точки появления: ключ, замок, дверь, EXIT, победа.

- [ ] **Step 7: Коммит**

```bash
git add index.html src/render/sign.ts src/render/scene.ts src/render/walls.ts src/main.ts
git commit -m "Add EXIT sign, final corridor glow and win screen"
```

---

### Task 13: Управление с телефона

Отлаживать **только на реальном устройстве** через `npm run dev -- --host`. DevTools врёт про инерцию, мультитач и размер пальца.

**Files:**
- Create: `src/input/touch.ts`, `public/manifest.webmanifest`
- Modify: `index.html` — экранные кнопки, стик, оверлей ориентации, ссылка на манифест
- Create: `src/input/index.ts` — выбор активной схемы
- Modify: `src/main.ts` — подключить выбор схемы
- Modify: `src/core/movement.ts` — сделать скорость аналоговой
- Test: `src/core/movement.test.ts`

**Interfaces:**
- Consumes: `InputSource`, `InputState` из Task 9
- Produces:
  - `createTouchInput(canvas: HTMLCanvasElement): InputSource`
  - `createInput(canvas: HTMLCanvasElement): InputSource` — обёртка, переключающаяся на тач по первому касанию

- [ ] **Step 1: Добавить мобильный интерфейс в `index.html`**

Вставить после блока `#hud`:

```html
    <div id="touch" hidden>
      <div id="stick"><div id="stick-knob"></div></div>
      <button id="btn-use" class="touch-btn" type="button">Действие</button>
    </div>
    <button id="btn-bag" class="touch-btn" type="button" hidden>Рюкзак</button>
    <div id="rotate" hidden><p>Поверни телефон горизонтально</p></div>
```

И в `<style>`:

```css
      #touch { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
      #touch[hidden] { display: none; }
      #stick { position: absolute; width: 120px; height: 120px; border-radius: 50%;
               border: 2px solid rgba(255,255,255,0.3); opacity: 0; }
      #stick.active { opacity: 1; }
      #stick-knob { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px;
                    margin: -26px 0 0 -26px; border-radius: 50%;
                    background: rgba(255,255,255,0.45); }
      /* Кнопки позиционируются от вьюпорта, поэтому им безразлично, лежат они
         внутри #touch или рядом с ним. Для «Рюкзака» это решающее обстоятельство. */
      .touch-btn { position: fixed; pointer-events: auto; border: none;
                   border-radius: 12px; background: rgba(255,255,255,0.18);
                   color: #fff; font: 600 16px system-ui, sans-serif;
                   min-width: 96px; min-height: 64px; }
      .touch-btn[hidden] { display: none; }
      .touch-btn:disabled { opacity: 0.35; }
      #btn-use { right: calc(20px + env(safe-area-inset-right));
                 bottom: calc(28px + env(safe-area-inset-bottom)); }
      /* Лежит СНАРУЖИ #touch и выше инвентаря (10). Внутри #touch это не работает:
         `position: fixed` создаёт контекст наложения ВСЕГДА, независимо от z-index,
         поэтому z-index потомка не может перебить соседний #inventory. Проверено
         замером elementFromPoint на отдельном стенде. А выйти из инвентаря на
         телефоне больше нечем: подсказка «I или Tab» пальцем не нажимается. */
      #btn-bag { right: calc(20px + env(safe-area-inset-right));
                 top: calc(20px + env(safe-area-inset-top)); min-height: 48px;
                 z-index: 11; }
      /* По умолчанию СКРЫТ. Показывается только медиазапросом ниже. Если написать
         здесь display: flex, оверлей закроет игру и в ландшафте тоже — снять его
         будет нечем, потому что JS только убирает атрибут hidden. */
      #rotate { position: fixed; inset: 0; display: none; align-items: center;
                justify-content: center; background: #0d0d10; color: #f2f2f2;
                font: 20px system-ui, sans-serif; text-align: center; z-index: 30; }
      @media (orientation: portrait) and (pointer: coarse) {
        #rotate:not([hidden]) { display: flex; }
      }
```

- [ ] **Step 1b: Создать `public/manifest.webmanifest`**

На iPhone нет Fullscreen API, поэтому единственный способ убрать адресную строку — добавление на главный экран. Файлы из `public/` Vite кладёт в корень сборки как есть.

```json
{
  "name": "Bandy",
  "short_name": "Bandy",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#0d0d10",
  "theme_color": "#0d0d10",
  "start_url": "."
}
```

Иконок нет намеренно: в проекте нет файлов-изображений, iOS в этом случае берёт скриншот страницы.

Дописать в `<head>` файла `index.html` (путь относительный — он корректно разрешится в подпапке `/bandy/`):

```html
    <link rel="manifest" href="manifest.webmanifest" />
```

И там же добавить современный аналог рядом со старым мета-тегом — не вместо него,
старый всё ещё нужен Safari:

```html
    <meta name="mobile-web-app-capable" content="yes" />
```

Браузер уже пишет в консоль, что `apple-mobile-web-app-capable` устарел; это
замечание висит запаркованным с задачи 8 и закрывается здесь.

- [ ] **Step 1c: Сделать скорость аналоговой в `src/core/movement.ts`**

Клавиатура даёт `move` длиной 1 или √2, поэтому `moveDelta` делит на длину и всегда
выдаёт полную скорость. Стик даёт любую длину от 0 до 1 — и при делении на длину
даже касание с отклонением в пиксель разогнало бы игрока до 3 м/с. Стик стал бы
переключателем вместо стика.

Заменить строку вычисления шага:

```ts
  // Делим на длину только когда она БОЛЬШЕ единицы: диагональ WASD остаётся
  // нормированной, а неполное отклонение стика даёт пропорционально меньший шаг.
  const step = (speed * dt) / Math.max(length, 1);
```

- [ ] **Step 1d: Дописать тесты в `src/core/movement.test.ts` и прогнать**

```ts
  it('половинное отклонение стика даёт половину скорости', () => {
    const half = moveDelta({ x: 0, y: -0.5 }, 0, 3, 0.1);
    expect(Math.hypot(half.x, half.z)).toBeCloseTo(0.15);
  });

  it('полное отклонение стика по диагонали не быстрее полной скорости', () => {
    const full = moveDelta({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 0.3, 3, 0.1);
    expect(Math.hypot(full.x, full.z)).toBeCloseTo(0.3);
  });
```

Run: `npm test src/core/movement.test.ts`
Expected: 10 passed. Восемь прежних тестов обязаны остаться зелёными — они
используют длины 1 и √2, на которых поведение не меняется.

- [ ] **Step 2: Создать `src/input/touch.ts`**

```ts
import { emptyState, type InputSource, type InputState } from './types';

const STICK_RADIUS = 60;

/**
 * Левая половина экрана — плавающий стик, правая — свайп обзора.
 * Каждый палец отслеживается по pointerId: иначе второй палец перехватит
 * события первого и управление начнёт залипать.
 */
export function createTouchInput(canvas: HTMLCanvasElement): InputSource {
  const state: InputState = emptyState();

  const panel = document.querySelector<HTMLElement>('#touch');
  const stick = document.querySelector<HTMLElement>('#stick');
  const knob = document.querySelector<HTMLElement>('#stick-knob');
  const useButton = document.querySelector<HTMLButtonElement>('#btn-use');
  const bagButton = document.querySelector<HTMLButtonElement>('#btn-bag');
  if (!panel || !stick || !knob || !useButton || !bagButton) {
    throw new Error('Разметка тач-управления не найдена.');
  }
  panel.hidden = false;
  // Кнопка рюкзака живёт вне #touch, поэтому показывается отдельно.
  bagButton.hidden = false;

  let stickPointer: number | null = null;
  let stickOrigin = { x: 0, y: 0 };
  let lookPointer: number | null = null;
  let lookLast = { x: 0, y: 0 };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    event.preventDefault();

    if (event.clientX < window.innerWidth / 2) {
      if (stickPointer !== null) return;
      stickPointer = event.pointerId;
      stickOrigin = { x: event.clientX, y: event.clientY };
      stick.style.left = `${event.clientX - STICK_RADIUS}px`;
      stick.style.top = `${event.clientY - STICK_RADIUS}px`;
      stick.classList.add('active');
    } else {
      if (lookPointer !== null) return;
      lookPointer = event.pointerId;
      lookLast = { x: event.clientX, y: event.clientY };
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch') return;
    event.preventDefault();

    if (event.pointerId === stickPointer) {
      const dx = event.clientX - stickOrigin.x;
      const dy = event.clientY - stickOrigin.y;
      const distance = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(distance, STICK_RADIUS) / distance;
      knob.style.transform = `translate(${dx * clamped}px, ${dy * clamped}px)`;
      state.move.x = (dx * clamped) / STICK_RADIUS;
      state.move.y = (dy * clamped) / STICK_RADIUS;
    } else if (event.pointerId === lookPointer) {
      state.look.dx += event.clientX - lookLast.x;
      state.look.dy += event.clientY - lookLast.y;
      lookLast = { x: event.clientX, y: event.clientY };
    }
  });

  // Стрелка в const, а не объявление функции: TypeScript сбрасывает сужение типа
  // на поднимаемом объявлении, и `stick`/`knob` снова стали бы возможно-null.
  const release = (event: PointerEvent): void => {
    if (event.pointerId === stickPointer) {
      stickPointer = null;
      state.move.x = 0;
      state.move.y = 0;
      knob.style.transform = '';
      stick.classList.remove('active');
    }
    if (event.pointerId === lookPointer) lookPointer = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  useButton.addEventListener('click', () => { state.interact = true; });
  bagButton.addEventListener('click', () => { state.toggleInventory = true; });

  return {
    state,
    isLocked: () => true, // на телефоне захватывать нечего, управление активно всегда
    consume() {
      state.look.dx = 0;
      state.look.dy = 0;
      state.interact = false;
      state.toggleInventory = false;
    },
  };
}

/** Подсвечивает кнопку действия, когда прицел на цели. Зовётся каждый кадр,
 *  поэтому элемент ищется один раз, а не при каждом вызове. */
let useButtonEl: HTMLButtonElement | null = null;
export function setUseButtonEnabled(enabled: boolean): void {
  useButtonEl ??= document.querySelector<HTMLButtonElement>('#btn-use');
  if (useButtonEl) useButtonEl.disabled = !enabled;
}
```

- [ ] **Step 3: Создать `src/input/index.ts`**

```ts
import type { InputSource } from './types';
import { createDesktopInput } from './desktop';
import { createTouchInput } from './touch';

export type { InputSource, InputState } from './types';

/**
 * Схема выбирается по факту первого события, а не по user agent — он врёт.
 * На ноутбуке с тачскрином работают обе и переключаются на лету.
 */
export function createInput(canvas: HTMLCanvasElement): InputSource {
  const desktop = createDesktopInput(canvas);
  let touch: InputSource | null = null;

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && touch === null) {
      touch = createTouchInput(canvas);
      const rotate = document.querySelector<HTMLElement>('#rotate');
      if (rotate) rotate.hidden = false;
    }
  }, { capture: true });

  return {
    get state() { return (touch ?? desktop).state; },
    isLocked: () => (touch ?? desktop).isLocked(),
    consume: () => (touch ?? desktop).consume(),
  };
}
```

- [ ] **Step 4: Переключить `src/main.ts` на общий вход**

Заменить импорт `createDesktopInput` на:

```ts
import { createInput } from './input';
import { setUseButtonEnabled } from './input/touch';
```

Заменить строку создания источника на `const input = createInput(canvas);`.

В блоке луча прицела после вычисления `targetId` добавить строку:

```ts
  setUseButtonEnabled(targetId !== undefined);
```

Строка `const state = input.state;` внутри цикла должна остаться на месте: `state` читается через геттер, поэтому переключение схемы подхватится со следующего кадра.

- [ ] **Step 4b: Закрыть два следствия появления тача в старых файлах**

Тач-схема живёт рядом с десктопной, а не вместо неё, и это ломает две вещи,
написанные раньше.

В `src/input/desktop.ts` защитить вызов захвата курсора:

```ts
    if (locked) return;
    // На iPhone Safari Pointer Lock не существует вовсе, и метод там undefined.
    // Десктопный источник остаётся живым после переключения на тач, а тап
    // синтезирует click — без этой проверки каждое касание экрана бросало бы
    // TypeError. Синхронный бросок, catch ниже его не поймал бы.
    if (typeof canvas.requestPointerLock !== 'function') return;
    canvas.requestPointerLock().catch(() => {});
```

В `src/main.ts` в обработчике победы убрать экранное управление:

```ts
    document.querySelector('#touch')?.setAttribute('hidden', '');
    document.querySelector('#btn-bag')?.setAttribute('hidden', '');
```

Иначе на белом экране победы останется торчать одна кнопка «Рюкзак»: панель
управления лежит ниже засветки (z-index 5 против 5, но засветка позже в DOM),
а кнопка рюкзака выше неё (11).

- [ ] **Step 5: Проверить на реальном телефоне**

Run: `npm run dev -- --host`

Открыть выданный сетевой адрес на телефоне и проверить по списку:
1. Касание левой половины экрана создаёт стик под пальцем, движение работает во все стороны.
2. Свайп по правой половине вращает камеру без инерции.
3. Оба пальца работают одновременно: идёшь и крутишь камеру.
4. Отпустить палец со стика — движение прекращается, стик исчезает.
5. Страница не скроллится и не зумится ни при каких жестах.
6. Кнопка «Взять» неактивна, пока прицел ни на чём, и загорается при наведении.
7. Кнопка «Рюкзак» открывает инвентарь, строки нажимаются пальцем без промахов.
8. В портретной ориентации показывается «Поверни телефон горизонтально», а в
   ландшафтной этого оверлея НЕТ. Если он виден в обоих — игра заблокирована.
8a. Открыть рюкзак и закрыть его той же кнопкой. Это единственный способ выйти
   из инвентаря на телефоне: подсказка «I или Tab» пальцем не нажимается.
9. Кнопки не заезжают под чёлку и под индикатор home.
9a. Добавить страницу на главный экран (Поделиться → На экран «Домой»), запустить с иконки — адресной строки быть не должно.
10. Пройти игру целиком с телефона.

- [ ] **Step 6: Коммит**

```bash
git add index.html public/manifest.webmanifest src/input src/core/movement.ts \
  src/core/movement.test.ts src/main.ts
git commit -m "Add touch controls, PWA manifest and mobile UI"
```

---

### Task 14: Обработка ошибок

Три случая должны давать читаемый текст, а не чёрный экран.

**Files:**
- Create: `src/ui/fatal.ts`
- Modify: `index.html` — контейнер экрана ошибки
- Modify: `src/main.ts` — обернуть загрузку и цикл

**Interfaces:**
- Consumes: результат `loadLevel()` из Task 8
- Produces: `showFatal(title: string, lines: string[]): void`

- [ ] **Step 1: Добавить контейнер в `index.html`**

Вставить перед закрывающим `</body>`:

```html
    <div id="fatal" hidden><h1 id="fatal-title"></h1><pre id="fatal-body"></pre></div>
```

И в `<style>`:

```css
      #fatal { position: fixed; inset: 0; overflow: auto; z-index: 40;
               background: #1a1013; color: #ffd7d7; padding: 32px;
               font: 15px/1.6 ui-monospace, monospace; }
      #fatal[hidden] { display: none; }
      #fatal h1 { margin: 0 0 16px; font-size: 20px; color: #ff9a9a; }
      #fatal pre { margin: 0; white-space: pre-wrap; }
```

- [ ] **Step 2: Создать `src/ui/fatal.ts`**

```ts
let shown = false;

/** Показывает читаемый экран ошибки. Повторные вызовы игнорируются. */
export function showFatal(title: string, lines: string[]): void {
  if (shown) return;
  shown = true;

  const root = document.querySelector<HTMLElement>('#fatal');
  const titleEl = document.querySelector<HTMLElement>('#fatal-title');
  const bodyEl = document.querySelector<HTMLElement>('#fatal-body');
  if (!root || !titleEl || !bodyEl) {
    // Разметки нет — падать молча нельзя, поэтому хотя бы в консоль.
    console.error(title, lines);
    return;
  }

  titleEl.textContent = title;
  bodyEl.textContent = lines.join('\n');
  root.hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
}

export function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Обернуть загрузку и цикл в `src/main.ts`**

Добавить импорт `import { hasWebGl, showFatal } from './ui/fatal';`.

Заменить проверку WebGL и загрузку уровня в начале файла:

```ts
if (!hasWebGl()) {
  showFatal('WebGL недоступен', [
    'Браузер не смог создать графический контекст.',
    'Проверь, включено ли аппаратное ускорение, и попробуй другой браузер.',
  ]);
  throw new Error('WebGL недоступен');
}

const loaded = loadLevel();
if (!loaded.ok) {
  showFatal('Уровень не прошёл валидацию', loaded.errors);
  throw new Error('Уровень не прошёл валидацию');
}
const level = loaded.level;
```

Обернуть тело игрового цикла. Найти `renderer.setAnimationLoop((now) => {` и превратить в:

```ts
renderer.setAnimationLoop((now) => {
  try {
    // ... всё существующее тело цикла без изменений ...
  } catch (error) {
    // Без остановки цикла браузер получит шестьдесят ошибок в секунду и вкладка ляжет.
    renderer.setAnimationLoop(null);
    showFatal('Ошибка в игровом цикле', [
      error instanceof Error ? error.message : String(error),
      error instanceof Error && error.stack ? error.stack : '',
    ]);
  }
});
```

- [ ] **Step 4: Проверить все три экрана**

1. **Ошибка валидации.** Временно испортить `src/levels/level_01.json`: заменить `"between": ["hall", "corridor_a"]` на `"between": ["hall", "nope"]`. Обновить страницу — должен появиться экран со списком ошибок, включая упоминание `nope`. Вернуть файл как было.
2. **Ошибка в цикле.** Временно добавить в тело цикла `if (now > 2000) throw new Error('проверка');`. Через две секунды должен появиться экран ошибки, а браузер не должен виснуть. Убрать строку.
3. **WebGL.** Проверяется чтением кода: убедиться, что `hasWebGl()` вызывается до создания рендерера.

- [ ] **Step 5: Прогнать тесты и убедиться, что ядро не задето**

Run: `npm test`
Expected: PASS, все тесты зелёные.

- [ ] **Step 6: Коммит**

```bash
git add index.html src/ui/fatal.ts src/main.ts
git commit -m "Add fatal error screens for validation, WebGL and loop failures"
```

---

### Task 15: Публикация на GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` — заполнить пустой файл

**Interfaces:**
- Consumes: скрипты `npm test` и `npm run build` из Task 1
- Produces: рабочий адрес `https://navoznov.github.io/bandy/`

- [ ] **Step 1: Создать `.github/workflows/deploy.yml`**

Тесты идут до сборки: красные не должны доезжать до продакшена.

```yaml
name: Deploy to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Заполнить `README.md`**

```markdown
# Bandy

Браузерная 3D-игра от первого лица: лабиринт комнат, инвентарь, взаимодействие
предметов, выход через дверь EXIT.

Играть: https://navoznov.github.io/bandy/

## Разработка

```
npm install
npm run dev              # dev-сервер
npm run dev -- --host    # доступно с телефона по локальной сети
npm test                 # тесты ядра
npm run build            # сборка в dist/
```

Управление: WASD — движение, мышь — обзор, E — взаимодействие, I или Tab — инвентарь.
На телефоне: левая половина экрана — движение, правая — обзор, кнопки справа.

## Документы

- Дизайн: `docs/superpowers/specs/2026-08-24-bandy-design.md`
- План реализации: `docs/superpowers/plans/2026-08-24-bandy-vertical-slice.md`
- Правила работы с кодом: `CLAUDE.md`
```

- [ ] **Step 3: Включить Pages в настройках репозитория**

Это единственный шаг, который выполняется руками владельцем репозитория и не может быть сделан из кода:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Без него workflow упадёт на шаге `configure-pages`.

- [ ] **Step 4: Закоммитить и запушить**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "Add GitHub Pages deployment workflow"
git push -u origin main
```

- [ ] **Step 5: Проверить публикацию**

1. Открыть вкладку Actions в репозитории, дождаться зелёного прогона.
2. Открыть `https://navoznov.github.io/bandy/` — игра должна запуститься.
3. Убедиться, что в консоли браузера нет 404 на ассеты. Если есть — почти наверняка потерялся `base: '/bandy/'` в `vite.config.ts`.
4. Открыть тот же адрес с телефона и пройти игру целиком.

---

## Порядок задач и что после каждой видно

| Задача | Что появляется |
|---|---|
| 1 | `npm test` и `npm run dev` работают |
| 2–7 | Ядро полностью готово и покрыто тестами, браузер не нужен |
| 8 | Видны комнаты, пол, потолок, стены, проёмы |
| 9 | Можно ходить мышью и WASD, стены не пропускают |
| 10 | Прицел, подсказки, открывающиеся двери, замки |
| 11 | Предметы, инвентарь, предмет в руках, ключ открывает замок |
| 12 | Табличка EXIT, финальный коридор, победа — игра проходима |
| 13 | Игра проходима с телефона |
| 14 | Ошибки видны текстом, а не чёрным экраном |
| 15 | Игра опубликована и доступна по адресу |
