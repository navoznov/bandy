# Антагонист Bandy — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в игру преследователя, который ходит по уровню своим маршрутом, видит игрока, гонится и ловит, — и дать игроку спринт с выносливостью, чтобы было чем отвечать.

**Architecture:** Всё поведение антагониста живёт в `src/core/` и не импортирует three.js: позиция непрерывна, путь ищется в ширину по графу «комната — дверь — комната», видимость — пересечение отрезка с теми же AABB-коллайдерами, которыми ходит игрок. Он присутствует на уровне ровно тогда, когда в JSON уровня есть блок `antagonist`. Слои `render/`, `ui/` и `audio/` только читают его состояние и ничего не решают.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Three.js, Vite, Vitest, WebAudio.

**Spec:** `docs/superpowers/specs/2026-08-27-bandy-antagonist-design.md`
Базовая спека: `docs/superpowers/specs/2026-08-24-bandy-design.md` — читать обе.

## Global Constraints

- **`src/core/` не импортирует three.js. Никогда.** Всё поведение антагониста — в ядре, под тестами, без браузера и WebGL.
- **Хоткеи только через `event.code`**, никогда `event.key`: иначе смена раскладки ломает управление.
- **Никаких файлов ассетов.** Звук генерируется процедурно через WebAudio, геометрия — из коробок.
- **Взаимодействия и содержимое уровня — данными.** Хардкод вида `if (room === 'kitchen')` запрещён.
- **Уровни 1 и 2 не меняются ни в чём.** Блока `antagonist` у них нет и не будет.
- **Единицы — метры.** Игрок: радиус 0.3, скорость 3.0. Комнаты высотой 3.0, стены 0.2, проём 0.9 × 2.1.
- **`npm test` = `tsc --noEmit && vitest run`.** Оба должны быть зелёными в конце каждой задачи.
- **Все новые константы — в `src/config.ts`**, а не в данных уровня: это настройка игры, а не свойство карты.
- **Сообщения валидатора называют идентификаторы**, а не человеческие названия: их читает автор карты и ищет по ним в JSON.
- **Ветка `antagonist`.** Не работать в `main`.
- Коммиты **без** `Co-Authored-By` и без пометок про Claude Code.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/core/types.ts` | + `AntagonistDef`, поле `antagonist?` в `Level` |
| `src/core/validate.ts` | + разбор блока и восемь правил |
| `src/core/pathing.ts` | **новый.** Путевые точки, поиск пути по графу комнат, расстояние по графу |
| `src/core/vision.ts` | **новый.** Отрезок × AABB, конус зрения, дальность |
| `src/core/antagonist.ts` | **новый.** Позиция, состояния, двери, ловля |
| `src/core/stamina.ts` | **новый.** Две чистые функции |
| `src/render/antagonist.ts` | **новый.** Меш, читает позицию |
| `src/ui/dread.ts` | **новый.** Виньетка |
| `src/audio/steps.ts` | **новый.** Шаги |
| `src/config.ts` | + блок `ANTAGONIST`, + поля спринта в `PLAYER` |
| `src/input/types.ts` | + `sprint` в `InputState` |
| `src/input/desktop.ts` | + `ShiftLeft` / `ShiftRight` |
| `src/input/touch.ts` | + тумблер `#btn-sprint` |
| `src/main.ts` | Сборка: шаг антагониста, спринт, экран поимки, `endGame()` |
| `index.html` | + кнопка «Бег», + полоска, + экран «Он тебя нашёл», + строки на стартовом экране |
| `src/levels/level_03.json` | + блок `antagonist` |

---

## Task 1: Правки базовой спеки

Спека — связывающий документ: код обязан ей соответствовать, а не наоборот. Поэтому базовая спека правится **до** первой строки кода.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-24-bandy-design.md`

**Interfaces:**
- Consumes: ничего.
- Produces: ничего для кода. Разблокирует все остальные задачи.

- [ ] **Step 1: Переписать §1**

Найти абзац «Референс по духу и ощущению — Hello Neighbor. Антагониста при этом нет: угрозы, преследования, стелса и проигрыша в игре не предусмотрено. Это исследовательская головоломка, а не хоррор про побег от врага.» и заменить на:

```
Референс по духу и ощущению — Hello Neighbor. С третьего уровня по дому ходит
антагонист: он патрулирует своим маршрутом, замечает игрока, гонится за ним и
ловит. Пойманный игрок теряет уровень целиком и начинает его заново. Уровни 1 и 2
остаются исследовательскими головоломками без угрозы — их карты нарисованы
деревьями с тупиками, и преследование там было бы наказанием за устройство карты,
а не за ошибку игрока. Подробности — в `2026-08-27-bandy-antagonist-design.md`.
```

- [ ] **Step 2: Поправить строку таблицы §2**

Заменить строку `| Антагонист | В v1 отсутствует |` на:

```
| Антагонист | Есть с третьего уровня. Блок `antagonist` в JSON уровня; нет блока — нет угрозы |
```

- [ ] **Step 3: Убрать три строки из таблицы §15**

Удалить строки `| Антагонист и преследование | ... |`, `| Звук | ... |` и `| Спринт | ... |`. Вместо них добавить перед таблицей абзац:

```
Три пункта из этого списка закрыты 27 августа 2026: антагонист, спринт и звук.
Условие, на котором откладывался спринт («если ходить окажется муторно»),
наступило после трёх пройденных уровней.
```

- [ ] **Step 4: Дописать §5 — блок `antagonist`**

В конец раздела «Прочие поля» добавить:

```
### Блок `antagonist`

Необязательный. Его отсутствие — не ошибка, а обычный уровень без угрозы.

    "antagonist": {
      "spawn": { "room": "hall_n", "x": 11, "z": 13 },
      "route": ["kitchen", "study", "store", "bedroom"],
      "keepOpen": ["d_ring_sw", "d_ring_se", "d_ring_nw", "d_ring_ne"]
    }

`spawn` — где он стоит в нулевую секунду, форма как у игрока, минус `yaw`.
`route` — комнаты, которые он обходит по кругу; это список целей, а не пошаговый
путь: дорогу между ними он ищет сам. `keepOpen` — двери, которые он никогда не
закрывает за собой.

Восемь правил валидации и обоснование каждого — в спеке антагониста §4.
```

- [ ] **Step 5: Дописать §8 — спринт**

В конец раздела «Тач-схема» добавить:

```
Спринт добавлен 27 августа 2026. На десктопе — удержание `ShiftLeft` или
`ShiftRight`. На телефоне — кнопка «Бег» тумблером: правая половина экрана занята
свайпом обзора, и кнопка-удержание парковала бы большой палец, оставляя игрока без
возможности повернуть на бегу.
```

- [ ] **Step 6: Проверить, что нигде не осталось «антагониста нет»**

Run: `grep -n "антагониста при этом нет\|проигрыша в игре не предусмотрено\|В v1 отсутствует" docs/superpowers/specs/2026-08-24-bandy-design.md`
Expected: пусто.

- [ ] **Step 7: Коммит**

```bash
git add docs/superpowers/specs/2026-08-24-bandy-design.md
git commit -m "Базовая спека: антагонист, спринт и звук больше не отложены"
```

---

## Task 2: Путевые точки и поиск пути

**Files:**
- Create: `src/core/pathing.ts`
- Test: `src/core/pathing.test.ts`

**Interfaces:**
- Consumes: `Level`, `RoomDef`, `DoorDef` из `core/types.ts`; `roomBounds`, `doorOnVerticalWall` из `core/validate.ts` (обе уже экспортированы); `ROOM` и `ANTAGONIST` из `config.ts`.
- Produces:
  - `export interface Point { x: number; z: number }`
  - `export const INSET: number` — 0.5 м
  - `export function roomCenter(room: RoomDef): Point`
  - `export function roomAt(level: Level, p: Point): string | null`
  - `export function doorWaypoints(level: Level, door: DoorDef, from: string): [Point, Point]`
  - `export function roomPath(level: Pick<Level, 'doors'>, from: string, to: string, passable: (door: DoorDef) => boolean): string[] | null`
  - `export function pathDistance(level: Level, from: Point, to: Point, passable: (door: DoorDef) => boolean): number | null`

- [ ] **Step 1: Написать падающий тест на отступ путевых точек**

Создать `src/core/pathing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { doorWaypoints, roomPath, roomAt, roomCenter, INSET } from './pathing';
import { validateLevel } from './validate';
import type { ItemDef, Level } from './types';

const NO_DEFS: Record<string, ItemDef> = {};

/**
 * Длинная узкая комната с дверью у самого края — случай, на котором наивная
 * версия «центр комнаты → центр двери» ведёт антагониста плечом в стене четыре
 * с половиной метра. На боевых уровнях такой комнаты нет, и регрессию там
 * никто не поймает, поэтому она живёт здесь.
 */
function longRoomLevel(): Level {
  const raw = {
    id: 'fixture_long',
    spawn: { room: 'hall', x: 1, z: 3, yaw: 0 },
    rooms: [
      { id: 'hall', rect: [0, 2, 4, 4], color: '#888888', light: 1 },
      { id: 'long', rect: [0, 6, 20, 2], color: '#888888', light: 1 },
    ],
    doors: [{ id: 'd_in', between: ['hall', 'long'], at: [1, 6] }],
    locks: {},
    items: [],
    triggers: [{ id: 'win', room: 'long', rect: [18, 6, 2, 2], effect: 'win' }],
    interactions: [],
  };
  const result = validateLevel(raw, NO_DEFS);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.level;
}

describe('путевые точки', () => {
  it('отступают от стены на 0.5 м в обе комнаты', () => {
    const level = longRoomLevel();
    const door = level.doors[0]!;
    const [inside, beyond] = doorWaypoints(level, door, 'hall');

    expect(INSET).toBeCloseTo(0.5);
    // Дверь на горизонтальной стене z = 6, значит точки разнесены по z.
    expect(inside).toEqual({ x: 1, z: 6 - INSET });
    expect(beyond).toEqual({ x: 1, z: 6 + INSET });
  });

  it('порядок точек зависит от того, из какой комнаты идём', () => {
    const level = longRoomLevel();
    const door = level.doors[0]!;
    const fromHall = doorWaypoints(level, door, 'hall');
    const fromLong = doorWaypoints(level, door, 'long');
    expect(fromLong[0]).toEqual(fromHall[1]);
    expect(fromLong[1]).toEqual(fromHall[0]);
  });

  it('центр комнаты и определение комнаты по точке', () => {
    const level = longRoomLevel();
    expect(roomCenter(level.rooms[1]!)).toEqual({ x: 10, z: 7 });
    expect(roomAt(level, { x: 10, z: 7 })).toBe('long');
    expect(roomAt(level, { x: 100, z: 100 })).toBe(null);
  });
});

describe('поиск пути по графу комнат', () => {
  it('находит цепочку комнат', () => {
    const level = longRoomLevel();
    expect(roomPath(level, 'hall', 'long', () => true)).toEqual(['hall', 'long']);
  });

  it('возвращает путь из одной комнаты, если идти никуда не надо', () => {
    const level = longRoomLevel();
    expect(roomPath(level, 'hall', 'hall', () => true)).toEqual(['hall']);
  });

  it('непроходимая дверь ребром не считается', () => {
    const level = longRoomLevel();
    expect(roomPath(level, 'hall', 'long', () => false)).toBe(null);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/core/pathing.test.ts`
Expected: FAIL — модуля `./pathing` нет.

- [ ] **Step 3: Реализовать**

Создать `src/core/pathing.ts`:

```ts
import { ANTAGONIST, ROOM } from '../config';
import { doorOnVerticalWall, roomBounds } from './validate';
import type { DoorDef, Level, RoomDef } from './types';

export interface Point { x: number; z: number }

/**
 * Насколько путевая точка отходит от линии стены. Стена строится внутрь комнаты
 * на всю толщину, поэтому свободное место начинается на `wallThickness`, а телу
 * радиуса `radius` нужен ещё и свой зазор. Сумма — минимальный отступ, при
 * котором тело нигде не задевает стену.
 */
export const INSET = ROOM.wallThickness + ANTAGONIST.radius;

export function roomCenter(room: RoomDef): Point {
  const b = roomBounds(room);
  return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
}

export function roomAt(level: Level, p: Point): string | null {
  for (const room of level.rooms) {
    const b = roomBounds(room);
    if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1) return room.id;
  }
  return null;
}

/**
 * Две точки прохода двери: первая внутри комнаты `from`, вторая — по ту сторону.
 * Центр двери путевой точкой НЕ является: он лежит на линии стены, и отрезок из
 * него в глубину комнаты ведёт тело сквозь стену тем дольше, чем положе угол.
 */
export function doorWaypoints(level: Level, door: DoorDef, from: string): [Point, Point] {
  const room = level.rooms.find((r) => r.id === from);
  if (!room) throw new Error(`Комнаты "${from}" нет в уровне.`);
  const [dx, dz] = door.at;
  const b = roomBounds(room);

  if (doorOnVerticalWall(door, room)) {
    // Стена на границе по X: точки разнесены по X. Внутрь комнаты — в сторону её центра.
    const inward = Math.abs(dx - b.x0) < 1e-9 ? +1 : -1;
    return [{ x: dx + inward * INSET, z: dz }, { x: dx - inward * INSET, z: dz }];
  }
  const inward = Math.abs(dz - b.z0) < 1e-9 ? +1 : -1;
  return [{ x: dx, z: dz + inward * INSET }, { x: dx, z: dz - inward * INSET }];
}

/** Кратчайшая цепочка комнат. `passable` решает, считается ли дверь ребром. */
export function roomPath(
  level: Pick<Level, 'doors'>, from: string, to: string, passable: (door: DoorDef) => boolean,
): string[] | null {
  if (from === to) return [from];
  const previous = new Map<string, string>();
  const seen = new Set<string>([from]);
  const queue: string[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const door of level.doors) {
      if (!door.between.includes(current) || !passable(door)) continue;
      const next = door.between[0] === current ? door.between[1] : door.between[0];
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, current);
      if (next === to) {
        const chain = [to];
        let step = to;
        while (step !== from) { step = previous.get(step)!; chain.unshift(step); }
        return chain;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Длина пути между двумя точками в метрах, считая по центрам комнат. Нужна
 * виньетке: расстояние по прямой врёт, антагонист бывает в трёх метрах за стеной
 * и в двадцати метрах ходьбы.
 */
export function pathDistance(
  level: Level, from: Point, to: Point, passable: (door: DoorDef) => boolean,
): number | null {
  const fromRoom = roomAt(level, from);
  const toRoom = roomAt(level, to);
  if (fromRoom === null || toRoom === null) return null;
  const chain = roomPath(level, fromRoom, toRoom, passable);
  if (chain === null) return null;

  let total = 0;
  let cursor = from;
  for (let i = 1; i < chain.length; i++) {
    const room = level.rooms.find((r) => r.id === chain[i]!)!;
    const next = roomCenter(room);
    total += Math.hypot(next.x - cursor.x, next.z - cursor.z);
    cursor = next;
  }
  return total + Math.hypot(to.x - cursor.x, to.z - cursor.z);
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/core/pathing.test.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Коммит**

```bash
git add src/core/pathing.ts src/core/pathing.test.ts
git commit -m "Путевые точки с отступом от стены и поиск пути по графу комнат"
```

---

## Task 3: Формат и валидация блока `antagonist`

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/validate.ts`
- Modify: `src/config.ts`
- Test: `src/core/validate.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `export interface AntagonistDef { spawn: { room: string; x: number; z: number }; route: string[]; keepOpen: string[] }`
  - `Level` получает поле `antagonist?: AntagonistDef`
  - `export const ANTAGONIST = { speed: 2.6, radius: 0.3, sight: 12, fov: 1.047, catchDistance: 1.2, searchSeconds: 6 } as const`

- [ ] **Step 1: Добавить константы**

В `src/config.ts`:

```ts
/** Настройка игры, а не свойство карты, — поэтому здесь, а не в JSON уровня. */
export const ANTAGONIST = {
  speed: 2.6,          // м/с, всегда — и в патруле, и в погоне
  radius: 0.3,         // как у игрока
  sight: 12,           // м, дальность обнаружения
  fov: 1.047,          // ±60° в радианах
  catchDistance: 1.2,  // м
  searchSeconds: 6,    // сколько ищет, потеряв игрока
} as const;
```

- [ ] **Step 2: Добавить типы**

В `src/core/types.ts`:

```ts
export interface AntagonistDef {
  /** Где он стоит в нулевую секунду. Как spawn игрока, минус yaw: он смотрит туда, куда идёт. */
  spawn: { room: string; x: number; z: number };
  /**
   * Комнаты, которые он обходит по кругу. Список ЦЕЛЕЙ, а не пошаговый путь:
   * дорогу между ними он ищет сам. Недостижимая сейчас комната из обхода
   * временно выпадает — так запертая комната становится убежищем.
   */
  route: string[];
  /** Двери, которые он никогда не закрывает за собой. Без них кольцо стояло бы закрытым. */
  keepOpen: string[];
}
```

И в `Level`: `antagonist?: AntagonistDef;`

- [ ] **Step 3: Написать падающие тесты валидатора**

В `src/core/validate.test.ts` добавить блок. Здесь и далее фикстуры строятся тем же приёмом, что уже используется в файле: объект-уровень, затем `validateLevel(raw, defs)`.

```ts
describe('блок antagonist', () => {
  function withAntagonist(extra: Record<string, unknown>): Record<string, unknown> {
    const lvl = baseLevel();               // существующий помощник файла
    lvl['antagonist'] = {
      spawn: { room: 'b', x: 12, z: 3 },
      route: ['a', 'b'],
      keepOpen: [],
      ...extra,
    };
    return lvl;
  }

  it('уровень без блока по-прежнему валиден', () => {
    const result = validateLevel(baseLevel(), TEST_ITEM_DEFS);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('несуществующая комната в обходе названа по идентификатору', () => {
    const result = validateLevel(withAntagonist({ route: ['a', 'nowhere'] }), TEST_ITEM_DEFS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Антагонист: комната "nowhere" из обхода не существует.',
      );
    }
  });

  it('дверь из keepOpen с замком — противоречие', () => {
    const result = validateLevel(withAntagonist({ keepOpen: ['d_ab'] }), TEST_ITEM_DEFS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Антагонист: дверь "d_ab" в "keepOpen", но на ней висит замок — открыть её он не может.',
      );
    }
  });

  it('он не может появляться в комнате игрока', () => {
    const result = validateLevel(
      withAntagonist({ spawn: { room: 'a', x: 2, z: 3 } }), TEST_ITEM_DEFS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Антагонист появляется в комнате "a", где появляется игрок.',
      );
    }
  });

  it('одной достижимой комнаты обхода мало — он дойдёт до неё и встанет', () => {
    // В фикстуре "b" за замком, значит в нулевую секунду достижима только "a".
    const result = validateLevel(
      withAntagonist({ spawn: { room: 'a', x: 2, z: 1 }, route: ['a', 'b'] }), TEST_ITEM_DEFS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Антагонист: из точки появления достижима только одна комната обхода — патруля не будет.',
      );
    }
  });

  it('комната уже метра не имеет безопасной точки для тела радиуса 0.3', () => {
    const lvl = baseLevel();
    (lvl['rooms'] as Array<Record<string, unknown>>).push(
      { id: 'slot', rect: [0, 10, 0.8, 4], color: '#888888', light: 1 });
    const result = validateLevel(lvl, TEST_ITEM_DEFS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Комната "slot" уже 1 м по оси X: в неё не помещается ни игрок, ни антагонист.',
      );
    }
  });
});
```

- [ ] **Step 4: Убедиться, что тесты падают**

Run: `npx vitest run src/core/validate.test.ts`
Expected: FAIL — сообщений нет, потому что правил ещё нет.

- [ ] **Step 5: Реализовать разбор и правила**

В `validate.ts` добавить `parseAntagonist()` рядом с прочими `parse*` (форма: объект с `spawn`, `route`, `keepOpen`; отсутствие поля — не ошибка, возвращает `undefined`), и после существующих смысловых проверок — восемь правил:

```ts
// Правило 8 общее, работает и без блока антагониста: игрок радиуса 0.3 в такую
// комнату тоже не помещается.
const minSide = 2 * (ROOM.wallThickness + PLAYER.radius);
for (const room of rooms) {
  const [, , w, d] = room.rect;
  if (w < minSide - EPS) {
    errors.push(`Комната "${room.id}" уже ${minSide} м по оси X: в неё не помещается ни игрок, ни антагонист.`);
  }
  if (d < minSide - EPS) {
    errors.push(`Комната "${room.id}" уже ${minSide} м по оси Z: в неё не помещается ни игрок, ни антагонист.`);
  }
}

if (antagonist) {
  const roomIds = new Set(rooms.map((r) => r.id));
  for (const id of antagonist.route) {
    if (!roomIds.has(id)) errors.push(`Антагонист: комната "${id}" из обхода не существует.`);
  }
  // Связность проверяется так, КАК ЕСЛИ БЫ все замки были сняты: замок временен,
  // и комната за ним законно выпадает из обхода до тех пор, пока игрок его не
  // откроет. Правило ловит комнату, в которую двери нет вовсе.
  for (let i = 0; i < antagonist.route.length; i++) {
    const from = antagonist.route[i]!;
    const to = antagonist.route[(i + 1) % antagonist.route.length]!;
    if (!roomIds.has(from) || !roomIds.has(to)) continue;
    if (roomPath({ doors }, from, to, () => true) === null) {
      errors.push(`Антагонист: из комнаты "${from}" нет пути в "${to}" — обход разорван.`);
    }
  }
  const doorIds = new Set(doors.map((d) => d.id));
  for (const id of antagonist.keepOpen) {
    const door = doors.find((d) => d.id === id);
    if (!door) { errors.push(`Антагонист: двери "${id}" из "keepOpen" не существует.`); continue; }
    if (door.lock !== undefined) {
      errors.push(`Антагонист: дверь "${id}" в "keepOpen", но на ней висит замок — открыть её он не может.`);
    }
  }
  const home = rooms.find((r) => r.id === antagonist.spawn.room);
  if (!home) {
    errors.push(`Антагонист: комнаты появления "${antagonist.spawn.room}" не существует.`);
  } else if (!contains(home, antagonist.spawn.x, antagonist.spawn.z)) {
    errors.push(`Антагонист: точка появления лежит вне комнаты "${home.id}".`);
  }
  if (antagonist.spawn.room === spawn.room) {
    errors.push(`Антагонист появляется в комнате "${spawn.room}", где появляется игрок.`);
  }
  // Нулевая секунда: все замки на месте. Нужны минимум ДВЕ комнаты обхода, иначе
  // он дойдёт до единственной и встанет.
  const reach = computeReachability(antagonist.spawn.room, doors, [], interactions);
  const live = new Set(antagonist.route.filter((id) => reach.rooms.has(id)));
  if (live.size === 1) {
    errors.push('Антагонист: из точки появления достижима только одна комната обхода — патруля не будет.');
  } else if (live.size === 0 && antagonist.route.length > 0) {
    errors.push('Антагонист: из точки появления не достижима ни одна комната обхода.');
  }
}
```

`doorIds` использовать для проверки существования двери; `roomPath` берётся из Task 3 — **эта задача выполняется после Task 3**, либо `roomPath` пишется в её рамках. См. порядок ниже.

- [ ] **Step 6: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS, включая все существующие тесты уровней 1-3.

- [ ] **Step 7: Коммит**

```bash
git add src/core/types.ts src/core/validate.ts src/core/validate.test.ts src/config.ts
git commit -m "Формат уровня: блок antagonist и восемь правил валидации"
```

## Task 4: Патруль в ядре

**Files:**
- Create: `src/core/antagonist.ts`
- Test: `src/core/antagonist.test.ts`

**Interfaces:**
- Consumes: `pathing.ts` целиком; `World` из `core/world.ts` (методы `isDoorOpen`, `isDestroyed`, `applyEffects`, `openDoors`); `ANTAGONIST`, `DOOR` из `config.ts`.
- Produces:
  - `export type AntagonistState = 'patrol' | 'chase' | 'search'`
  - `export class Antagonist` с полями `x: number`, `z: number`, `facing: number`, `state: AntagonistState`, `seesPlayer: boolean` и методами `step(dt: number, player: Point, boxes: readonly Aabb[]): void`, `caught(player: Point): boolean`, `distanceTo(player: Point): number | null`
  - Соглашение о `facing`: радианы, направление взгляда — `(-sin facing, -cos facing)`, ровно как `yaw` игрока. Позволяет рендеру писать `mesh.rotation.y = facing` без пересчёта.

В этой задаче реализуется **только патруль**: поля `state` и `seesPlayer` заводятся, но `state` всегда `'patrol'`, а `seesPlayer` всегда `false`. Зрение и состояния — Tasks 6 и 7.

- [ ] **Step 1: Написать падающие тесты патруля**

Создать `src/core/antagonist.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Antagonist } from './antagonist';
import { World } from './world';
import { loadLevel } from '../levels';
import { ANTAGONIST } from '../config';

function fresh(): { world: World; ai: Antagonist } {
  const loaded = loadLevel('level_03');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const world = new World(loaded.level);
  return { world, ai: new Antagonist(loaded.level, world) };
}

/** Прогоняет N секунд игрового времени шагами по 16 мс. */
function run(ai: Antagonist, seconds: number, player = { x: -100, z: -100 }): void {
  const steps = Math.round(seconds / 0.016);
  for (let i = 0; i < steps; i++) ai.step(0.016, player, []);
}

describe('патруль', () => {
  it('появляется в точке из данных уровня', () => {
    const { ai } = fresh();
    expect(ai.x).toBeCloseTo(11);
    expect(ai.z).toBeCloseTo(13);
    expect(ai.state).toBe('patrol');
  });

  it('за минуту уходит от точки появления', () => {
    const { ai } = fresh();
    const start = { x: ai.x, z: ai.z };
    run(ai, 60);
    expect(Math.hypot(ai.x - start.x, ai.z - start.z)).toBeGreaterThan(5);
  });

  it('открывает закрытые двери на пути', () => {
    const { world, ai } = fresh();
    expect(world.isDoorOpen('d_ring_ne')).toBe(false);
    run(ai, 60);
    // За минуту он успевает уйти с севера в кабинет через кольцо.
    expect(world.openDoors().size).toBeGreaterThan(0);
  });

  it('запертую дверь не открывает никогда', () => {
    const { world, ai } = fresh();
    run(ai, 300);
    expect(world.isDoorOpen('d_hall_kitchen')).toBe(false);
    expect(world.isDestroyed('lock_copper')).toBe(false);
  });

  it('дверь из keepOpen не закрывает за собой', () => {
    const { world, ai } = fresh();
    run(ai, 300);
    const closedRing = ['d_ring_sw', 'd_ring_se', 'd_ring_nw', 'd_ring_ne']
      .filter((id) => !world.isDoorOpen(id));
    // Все двери кольца, которые он хоть раз прошёл, остались открытыми.
    // За пять минут он проходит кольцо многократно, значит закрытых быть не должно.
    expect(closedRing).toEqual([]);
  });

  it('тело нигде не задевает стены за весь обход', () => {
    const { world, ai } = fresh();
    const level = world.level;
    for (let i = 0; i < 300 / 0.016; i++) {
      ai.step(0.016, { x: -100, z: -100 }, []);
      const boxes = activeColliders(buildColliders(level), world.openDoors());
      for (const b of boxes) {
        const insideX = ai.x > b.x0 - ANTAGONIST.radius && ai.x < b.x1 + ANTAGONIST.radius;
        const insideZ = ai.z > b.z0 - ANTAGONIST.radius && ai.z < b.z1 + ANTAGONIST.radius;
        expect(insideX && insideZ,
          `тело в коллайдере на ${(i * 0.016).toFixed(1)} с: (${ai.x.toFixed(2)}, ${ai.z.toFixed(2)})`,
        ).toBe(false);
      }
    }
  });
});
```

Импорты `activeColliders`, `buildColliders` добавить из `./colliders`.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/core/antagonist.test.ts`
Expected: FAIL — модуля `./antagonist` нет.

- [ ] **Step 3: Реализовать патруль**

Создать `src/core/antagonist.ts`. Ключевые решения:

- Очередь путевых точек `Point[]`. Пустая — берётся следующая цель обхода.
- Цель обхода — следующая достижимая комната из `route`; недостижимые пропускаются. Если достижимых нет вовсе, он стоит.
- Путь до цели: `roomPath(level, current, target, passable)`, где `passable = (d) => d.lock === undefined || world.isDestroyed(d.lock)`.
- Из цепочки комнат строится цепочка точек: для каждой пары соседних комнат — `doorWaypoints`, плюс `roomCenter` целевой комнаты в конце.
- Дверь запоминается вместе с точкой: `{ x, z, door?: string }`. Дойдя до первой точки двери — если дверь закрыта, `world.applyEffects([{ kind: 'toggleDoor', door }])` и пауза `DOOR.openSeconds`. Дойдя до второй — если двери нет в `keepOpen` и состояние `'patrol'`, закрыть тем же эффектом.
- `facing` обновляется из направления шага: `Math.atan2(-dx, -dz)`.

```ts
import { ANTAGONIST, DOOR } from '../config';
import { doorWaypoints, roomAt, roomCenter, roomPath, type Point } from './pathing';
import type { Aabb } from './colliders';
import type { AntagonistDef, DoorDef, Level } from './types';
import type { World } from './world';

export type AntagonistState = 'patrol' | 'chase' | 'search';

/** Точка маршрута. `door` — дверь, к которой она относится; `closing` — вторая из пары. */
interface Step extends Point { door?: string; closing?: boolean }

export class Antagonist {
  x: number;
  z: number;
  /** Радианы по соглашению yaw игрока: взгляд направлен в (-sin, -cos). */
  facing = 0;
  state: AntagonistState = 'patrol';
  seesPlayer = false;

  private readonly def: AntagonistDef;
  private queue: Step[] = [];
  private routeIndex = 0;
  private waitLeft = 0;

  constructor(private readonly level: Level, private readonly world: World) {
    const def = level.antagonist;
    if (!def) throw new Error('В уровне нет блока antagonist.');
    this.def = def;
    this.x = def.spawn.x;
    this.z = def.spawn.z;
  }

  /** Запертая дверь для него стена: замки — головоломка игрока. */
  private passable = (door: DoorDef): boolean =>
    door.lock === undefined || this.world.isDestroyed(door.lock);

  step(dt: number, _player: Point, _boxes: readonly Aabb[]): void {
    if (this.waitLeft > 0) { this.waitLeft -= dt; return; }
    if (this.queue.length === 0) this.planPatrol();
    this.advance(dt);
  }

  private planPatrol(): void {
    const from = roomAt(this.level, { x: this.x, z: this.z });
    if (from === null || this.def.route.length === 0) return;

    // Недостижимая сейчас комната обхода пропускается: снятый игроком замок
    // вернёт её в цикл сам. Перебор ограничен длиной обхода — если недостижимы
    // все, он стоит, и это ловит правило 7 валидатора у автора карты.
    for (let tried = 0; tried < this.def.route.length; tried++) {
      const target = this.def.route[this.routeIndex % this.def.route.length]!;
      this.routeIndex = (this.routeIndex + 1) % this.def.route.length;
      const chain = roomPath(this.level, from, target, this.passable);
      if (chain === null) continue;
      const steps = this.pointsAlong(chain);
      const room = this.level.rooms.find((r) => r.id === target);
      if (room) steps.push(roomCenter(room));
      if (steps.length > 0) { this.queue = steps; return; }
    }
  }

  /** Пара точек на каждую дверь цепочки: подход с этой стороны и выход с той. */
  private pointsAlong(chain: string[]): Step[] {
    const steps: Step[] = [];
    for (let i = 1; i < chain.length; i++) {
      const from = chain[i - 1]!;
      const to = chain[i]!;
      const door = this.level.doors.find(
        (d) => d.between.includes(from) && d.between.includes(to));
      if (!door) continue;
      const [near, far] = doorWaypoints(this.level, door, from);
      steps.push({ ...near, door: door.id });
      steps.push({ ...far, door: door.id, closing: true });
    }
    return steps;
  }

  private advance(dt: number): void {
    const target = this.queue[0];
    if (!target) return;

    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1e-6) this.facing = Math.atan2(-dx, -dz);

    const move = ANTAGONIST.speed * dt;
    if (distance > move) {
      this.x += (dx / distance) * move;
      this.z += (dz / distance) * move;
      return;
    }

    this.x = target.x;
    this.z = target.z;
    this.queue.shift();
    this.arrive(target);
  }

  private arrive(step: Step): void {
    if (step.door === undefined) return;

    if (!step.closing) {
      // Подошёл к двери. Закрытую надо открыть и дождаться створки — иначе он
      // пройдёт сквозь полотно на глазах у игрока.
      if (!this.world.isDoorOpen(step.door)) {
        this.world.applyEffects([{ kind: 'toggleDoor', door: step.door }]);
        this.waitLeft = DOOR.openSeconds;
      }
      return;
    }

    // Вышел с другой стороны — закрывает за собой. Кроме дверей из keepOpen:
    // закрытая им дверь кольца съедает отрыв, накопленный за три секунды бега.
    if (this.def.keepOpen.includes(step.door)) return;
    if (this.world.isDoorOpen(step.door)) {
      this.world.applyEffects([{ kind: 'toggleDoor', door: step.door }]);
    }
  }

  /** Пока зрения нет (Task 6), ловли нет тоже. */
  caught(_player: Point): boolean {
    return false;
  }
}
```

`_player` и `_boxes` в `step()` не используются до Task 6 — подчёркивание гасит
`noUnusedParameters`, а сигнатура сразу правильная, чтобы Task 5 не переписывал вызов.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/core/antagonist.ts src/core/antagonist.test.ts
git commit -m "Патруль антагониста: обход по маршруту, двери, отступ от стен"
```

---

## Task 5: Меш и подключение — видимый ходящий антагонист

**Files:**
- Create: `src/render/antagonist.ts`
- Modify: `src/levels/level_03.json`
- Modify: `src/main.ts`
- Test: `src/levels/level_03.test.ts`

**Interfaces:**
- Consumes: `Antagonist` из Task 4.
- Produces: `export function createAntagonistMesh(): { group: THREE.Group; update(x: number, z: number, facing: number): void }`

- [ ] **Step 1: Дописать тест уровня**

В `src/levels/level_03.test.ts` добавить:

```ts
it('у уровня есть антагонист, и он появляется не там, где игрок', () => {
  const level = load();
  expect(level.antagonist).toBeDefined();
  expect(level.antagonist?.spawn.room).not.toBe(level.spawn.room);
  expect(level.antagonist?.route).toEqual(['kitchen', 'study', 'store', 'bedroom']);
});

it('на первых двух уровнях антагониста нет и не появится', () => {
  for (const id of ['level_01', 'level_02']) {
    const loaded = loadLevel(id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.level.antagonist).toBeUndefined();
  }
});

it('ни одна дверь кольца не закрывается за ним', () => {
  const level = load();
  const ring = level.doors.filter((d) => d.id.startsWith('d_ring_')).map((d) => d.id);
  expect([...(level.antagonist?.keepOpen ?? [])].sort()).toEqual([...ring].sort());
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/levels/level_03.test.ts`
Expected: FAIL — `level.antagonist` не определён.

- [ ] **Step 3: Добавить блок в уровень**

В `src/levels/level_03.json`, после блока `locks`:

```json
"antagonist": {
  "spawn": { "room": "hall_n", "x": 11, "z": 13 },
  "route": ["kitchen", "study", "store", "bedroom"],
  "keepOpen": ["d_ring_sw", "d_ring_se", "d_ring_nw", "d_ring_ne"]
},
```

Точка появления выбрана на севере, потому что игрок появляется на юге, в `stair`. Кухня, первая точка обхода, тоже на юге — но она заперта медным замком и в нулевую секунду из обхода выпадает, так что первая же цель уводит его в кабинет, на восток.

- [ ] **Step 4: Написать меш**

Создать `src/render/antagonist.ts`:

```ts
import * as THREE from 'three';
import { ANTAGONIST } from '../config';

/**
 * Две коробки и плоский цвет. Без текстур (требование заказчика) и без теней
 * (первое, что съедает fps на мобильных GPU). Лёгкое свечение — чтобы читался
 * в комнатах с light 0.4, а не растворялся в них.
 */
export function createAntagonistMesh(): {
  group: THREE.Group;
  update(x: number, z: number, facing: number): void;
} {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#2b2f36', emissive: '#171a1f', emissiveIntensity: 0.6,
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(ANTAGONIST.radius * 2, 1.35, ANTAGONIST.radius * 1.4), material);
  body.position.y = 0.675;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), material);
  head.position.y = 1.5;
  group.add(body, head);

  return {
    group,
    update(x, z, facing) {
      group.position.set(x, 0, z);
      // `facing` задан тем же соглашением, что и yaw игрока: взгляд в (-sin, -cos).
      // Собственное «вперёд» объекта в three.js — тоже -Z, поэтому пересчёта нет.
      group.rotation.y = facing;
    },
  };
}
```

- [ ] **Step 5: Подключить в `main.ts`**

Рядом с созданием прочих объектов сцены (после `const allColliders = buildColliders(level);`):

```ts
// Антагониста может не быть: блок в JSON уровня необязателен.
const antagonist = level.antagonist ? new Antagonist(level, world) : null;
const antagonistMesh = antagonist ? createAntagonistMesh() : null;
if (antagonistMesh) scene.add(antagonistMesh.group);
```

В игровом цикле, **внутри той же ветки, что и движение игрока** — то есть под `if (input.isLocked() && !paused && !start.isVisible())`, сразу после `world.checkTriggers(...)`:

```ts
// Под тем же условием, что и игрок: инвентарь ставит игру на паузу, и без этого
// антагонист шёл бы, пока игрок листает рюкзак, и ловил бы его сквозь оверлей.
if (antagonist) {
  antagonist.step(dt, player, activeColliders(allColliders, world.openDoors()));
}
```

И после блока с камерой:

```ts
if (antagonist && antagonistMesh) {
  antagonistMesh.update(antagonist.x, antagonist.z, antagonist.facing);
}
```

- [ ] **Step 6: Проверить машинно и глазами**

Run: `npm test` — Expected: PASS.
Run: `npm run dev` — открыть `#level_03`, убедиться, что фигура ходит по коридорам, открывает двери и не проходит сквозь стены. Уровни `#level_01` и `#level_02` открыть тоже: там его быть не должно и ничего не должно измениться.
**Открыть рюкзак и убедиться, что антагонист замирает** — он считается под тем же
условием, что и движение игрока, и без этого ловил бы игрока сквозь оверлей.

- [ ] **Step 7: Коммит**

```bash
git add src/render/antagonist.ts src/main.ts src/levels/level_03.json src/levels/level_03.test.ts
git commit -m "Антагонист появляется на третьем уровне и ходит по маршруту"
```

---

## Task 6: Зрение

**Files:**
- Create: `src/core/vision.ts`
- Test: `src/core/vision.test.ts`

**Interfaces:**
- Consumes: `Aabb` из `core/colliders.ts`; `Point` из `core/pathing.ts`.
- Produces:
  - `export function segmentBlocked(a: Point, b: Point, boxes: readonly Aabb[]): boolean`
  - `export function canSee(from: Point, facing: number, to: Point, boxes: readonly Aabb[], range: number, fov: number): boolean`

- [ ] **Step 1: Написать падающий тест**

Создать `src/core/vision.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canSee, segmentBlocked } from './vision';
import type { Aabb } from './colliders';

const WALL: Aabb[] = [{ x0: 4, x1: 4.2, z0: -10, z1: 10 }];
// Взгляд по соглашению yaw: направление (-sin f, -cos f).
// facing = -Math.PI / 2 смотрит в +X.
const EAST = -Math.PI / 2;

describe('отрезок и прямоугольник', () => {
  it('стена между точками перекрывает луч', () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 8, z: 0 }, WALL)).toBe(true);
  });

  it('стена в стороне не мешает', () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 3, z: 0 }, WALL)).toBe(false);
  });

  it('пустой список коллайдеров не перекрывает ничего', () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 100, z: 100 }, [])).toBe(false);
  });
});

describe('видит ли игрока', () => {
  const from = { x: 0, z: 0 };

  it('видит прямо перед собой', () => {
    expect(canSee(from, EAST, { x: 5, z: 0 }, [], 12, 1.047)).toBe(true);
  });

  it('не видит за спиной — это и есть подкрадывание', () => {
    expect(canSee(from, EAST, { x: -1, z: 0 }, [], 12, 1.047)).toBe(false);
  });

  it('не видит дальше своей дальности', () => {
    expect(canSee(from, EAST, { x: 13, z: 0 }, [], 12, 1.047)).toBe(false);
  });

  it('не видит сквозь стену', () => {
    expect(canSee(from, EAST, { x: 8, z: 0 }, WALL, 12, 1.047)).toBe(false);
  });

  it('за границей конуса не видит, внутри — видит', () => {
    // 45° вбок при конусе ±60° — внутри; 75° — снаружи.
    const inside = { x: Math.cos(Math.PI / 4) * 5, z: -Math.sin(Math.PI / 4) * 5 };
    const outside = { x: Math.cos(Math.PI / 2.4) * 5, z: -Math.sin(Math.PI / 2.4) * 5 };
    expect(canSee(from, EAST, inside, [], 12, 1.047)).toBe(true);
    expect(canSee(from, EAST, outside, [], 12, 1.047)).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/core/vision.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать**

Создать `src/core/vision.ts`:

```ts
import type { Aabb } from './colliders';
import type { Point } from './pathing';

/**
 * Пересекает ли отрезок прямоугольник. Метод срезов: по каждой оси считается
 * отрезок параметра t, на котором луч находится внутри полосы прямоугольника;
 * пересечение есть, если оба отрезка перекрываются внутри [0, 1].
 */
function hits(a: Point, b: Point, box: Aabb): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let tMin = 0;
  let tMax = 1;

  for (const [origin, delta, lo, hi] of [
    [a.x, dx, box.x0, box.x1],
    [a.z, dz, box.z0, box.z1],
  ] as const) {
    if (Math.abs(delta) < 1e-12) {
      // Луч параллелен полосе: либо он внутри неё всегда, либо снаружи всегда.
      if (origin < lo || origin > hi) return false;
      continue;
    }
    const t1 = (lo - origin) / delta;
    const t2 = (hi - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }
  return true;
}

export function segmentBlocked(a: Point, b: Point, boxes: readonly Aabb[]): boolean {
  for (const box of boxes) if (hits(a, b, box)) return true;
  return false;
}

/**
 * `facing` — радианы по соглашению yaw игрока: взгляд направлен в (-sin, -cos).
 * Конус обязателен: за спиной он игрока не видит, и это единственное, что делает
 * подкрадывание осмысленным.
 */
export function canSee(
  from: Point, facing: number, to: Point,
  boxes: readonly Aabb[], range: number, fov: number,
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance > range) return false;
  if (distance < 1e-6) return true;

  const forwardX = -Math.sin(facing);
  const forwardZ = -Math.cos(facing);
  const cosAngle = (forwardX * dx + forwardZ * dz) / distance;
  if (cosAngle < Math.cos(fov)) return false;

  return !segmentBlocked(from, to, boxes);
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/core/vision.test.ts`
Expected: PASS, 8 тестов.

- [ ] **Step 5: Коммит**

```bash
git add src/core/vision.ts src/core/vision.test.ts
git commit -m "Зрение антагониста: конус, дальность и луч по прямоугольникам"
```

---

## Task 7: Состояния и ловля

**Files:**
- Modify: `src/core/antagonist.ts`
- Test: `src/core/antagonist.test.ts`
- Test: `src/core/chase.test.ts` (создать)

**Interfaces:**
- Consumes: `canSee` из Task 6; всё из Task 4.
- Produces: `state` принимает все три значения; `seesPlayer` работает; `caught(player)` и `distanceTo(player)` работают.

- [ ] **Step 1: Написать главный тест — погоня в числах**

Создать `src/core/chase.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Antagonist } from './antagonist';
import { World } from './world';
import { activeColliders, buildColliders } from './colliders';
import { loadLevel } from '../levels';
import { PLAYER } from '../config';
import type { Point } from './pathing';

/**
 * Утверждение о ЗАМЫСЛЕ, а не об ощущении: убегающий по кольцу со спринтом
 * уходит, забежавший в тупик — попадается. Ловит регрессию, которую иначе
 * заметит только палец на телефоне.
 */
function simulate(path: Point[], speed: number): { caught: boolean; seconds: number } {
  const loaded = loadLevel('level_03');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const world = new World(loaded.level);
  const all = buildColliders(loaded.level);
  const ai = new Antagonist(loaded.level, world);

  // Ставим его вплотную к игроку и лицом к нему: моделируем момент, когда он
  // уже увидел, а не весь путь до этого.
  const player = { ...path[0]! };
  ai.x = player.x; ai.z = player.z - 3;
  ai.facing = Math.PI;                      // взгляд в +z, на игрока

  const dt = 1 / 60;
  let leg = 1;
  for (let i = 0; i < 60 * 60; i++) {       // не больше минуты игрового времени
    const target = path[leg];
    if (target) {
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.1) { leg++; }
      else {
        const move = Math.min(speed * dt, distance);
        player.x += (dx / distance) * move;
        player.z += (dz / distance) * move;
      }
    }
    ai.step(dt, player, activeColliders(all, world.openDoors()));
    if (ai.caught(player)) return { caught: true, seconds: i * dt };
  }
  return { caught: false, seconds: 60 };
}

describe('погоня в числах', () => {
  it('убегающий по кольцу со спринтом уходит', () => {
    // Юг -> восток -> север -> запад по осевым линиям кольца.
    const ring: Point[] = [
      { x: 8, z: 5 }, { x: 15, z: 5 }, { x: 15, z: 13 }, { x: 7, z: 13 }, { x: 7, z: 5 },
    ];
    expect(simulate(ring, PLAYER.sprintSpeed).caught).toBe(false);
  });

  it('забежавший в тупик попадается', () => {
    // Из коридора в спальню и в её дальний угол — выхода оттуда нет.
    const deadEnd: Point[] = [
      { x: 7, z: 9 }, { x: 3, z: 9 }, { x: 1, z: 12 },
    ];
    expect(simulate(deadEnd, PLAYER.sprintSpeed).caught).toBe(true);
  });

  it('идущий шагом по прямой не уходит бесконечно, но и не гибнет сразу', () => {
    const straight: Point[] = [{ x: 8, z: 5 }, { x: 15, z: 5 }];
    const result = simulate(straight, PLAYER.speed);
    expect(result.seconds).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 2: Дописать тесты состояний**

В `src/core/antagonist.test.ts`:

```ts
describe('состояния', () => {
  it('увидев игрока, переходит в погоню', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    const inFront = { x: ai.x, z: ai.z - 2 };
    ai.facing = 0;                        // взгляд в -z
    ai.step(0.016, inFront, boxes);
    expect(ai.seesPlayer).toBe(true);
    expect(ai.state).toBe('chase');
  });

  it('за спиной не замечает', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    ai.facing = 0;
    ai.step(0.016, { x: ai.x, z: ai.z + 1 }, boxes);
    expect(ai.seesPlayer).toBe(false);
    expect(ai.state).toBe('patrol');
  });

  it('потеряв игрока, ищет, а через searchSeconds возвращается к патрулю', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    ai.facing = 0;
    ai.step(0.016, { x: ai.x, z: ai.z - 2 }, boxes);
    expect(ai.state).toBe('chase');

    const far = { x: -100, z: -100 };
    ai.step(0.016, far, boxes);
    expect(ai.state).toBe('search');

    for (let i = 0; i < (ANTAGONIST.searchSeconds + 2) / 0.016; i++) ai.step(0.016, far, boxes);
    expect(ai.state).toBe('patrol');
  });

  it('ловля требует и дистанции, и видимости', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    ai.facing = 0;
    const behind = { x: ai.x, z: ai.z + 0.5 };
    ai.step(0.016, behind, boxes);
    expect(ai.caught(behind)).toBe(false);   // метр за спиной безопасен

    const front = { x: ai.x, z: ai.z - 0.5 };
    ai.step(0.016, front, boxes);
    expect(ai.caught(front)).toBe(true);
  });

  it('в погоне двери за собой не закрывает', () => {
    const { world, ai } = fresh();
    world.applyEffects([{ kind: 'toggleDoor', door: 'd_hall_nursery' }]);
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    ai.facing = 0;
    for (let i = 0; i < 5 / 0.016; i++) ai.step(0.016, { x: ai.x, z: ai.z - 2 }, boxes);
    expect(ai.state).toBe('chase');
    expect(world.isDoorOpen('d_hall_nursery')).toBe(true);
  });
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run src/core/antagonist.test.ts src/core/chase.test.ts`
Expected: FAIL — `state` всегда `'patrol'`, `caught` возвращает `false`.

- [ ] **Step 4: Реализовать состояния**

В `step()` перед планированием пути:

```ts
this.seesPlayer = canSee(
  { x: this.x, z: this.z }, this.facing, player, boxes, ANTAGONIST.sight, ANTAGONIST.fov);

if (this.seesPlayer) {
  if (this.state !== 'chase') this.queue = [];   // старый план больше не нужен
  this.state = 'chase';
  this.lastSeen = { ...player };
  this.searchLeft = ANTAGONIST.searchSeconds;
} else if (this.state === 'chase') {
  this.state = 'search';
  this.queue = [];
} else if (this.state === 'search') {
  this.searchLeft -= dt;
  if (this.searchLeft <= 0) { this.state = 'patrol'; this.queue = []; }
}
```

Планирование цели зависит от состояния:

- `'chase'` — цель `this.lastSeen`. Пока игрок в другой комнате, путь строится путевыми точками; в одной комнате — прямой отрезок к нему. Путь пересчитывается, когда игрок сменил комнату, а не каждый кадр.
- `'search'` — цель `this.lastSeen`; дойдя, очередь пуста и он стоит, доживая `searchLeft`, поворачиваясь на месте (`this.facing += dt`).
- `'patrol'` — следующая достижимая комната обхода. Возвращаясь из поиска, выбирается та комната обхода, до которой короче всего идти: `roomPath` до каждой, минимальная длина цепочки.

**Если пути к игроку нет** — он ушёл за дверь, которую антагонист открыть не может, — состояние становится `'search'` с целью `lastSeen`. Это и есть механика убежища.

Закрытие двери за собой обусловлено состоянием:

```ts
// Закрывает только в патруле. В погоне и поиске — нет: закрытая им дверь на
// маршруте побега съедает отрыв, накопленный за три секунды бега.
if (this.state === 'patrol' && step.closing && step.door
    && !this.def.keepOpen.includes(step.door)
    && this.world.isDoorOpen(step.door)) {
  this.world.applyEffects([{ kind: 'toggleDoor', door: step.door }]);
}
```

Ловля:

```ts
caught(player: Point): boolean {
  if (!this.seesPlayer) return false;
  return Math.hypot(player.x - this.x, player.z - this.z) <= ANTAGONIST.catchDistance;
}
```

Расстояние по графу для виньетки:

```ts
distanceTo(player: Point): number | null {
  return pathDistance(this.level, { x: this.x, z: this.z }, player,
    (d) => d.lock === undefined || this.world.isDestroyed(d.lock));
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/core/antagonist.ts src/core/antagonist.test.ts src/core/chase.test.ts
git commit -m "Три состояния антагониста, ловля и погоня в числах"
```

---

## Task 8: Экран поимки и общий `endGame()`

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `antagonist.caught(player)` из Task 7.
- Produces: `function endGame(overlay: HTMLElement): void` внутри `main.ts`.

- [ ] **Step 1: Разметка**

В `index.html`, рядом с `#win`, добавить:

```html
<div id="caught" hidden>
  <p>Он тебя нашёл.</p>
  <button id="caught-again" type="button">Ещё раз</button>
</div>
```

Стили — теми же правилами, что у `#win`, добавив `#caught` в тот же селектор. Кнопке — `min-height: 48px`, как у `#win button`: она нажимается пальцем.

- [ ] **Step 2: Вынести общую часть**

В `main.ts` обработчик победы уже выполняет пять действий. Вынести их:

```ts
/**
 * Конец игры, победой или поимкой. Пять действий были написаны для экрана победы;
 * ловля добавляет второй такой же случай, поэтому общая часть здесь. Это уборка
 * дубля, который создаёт эта же правка, а не рефакторинг заодно.
 */
function endGame(overlay: HTMLElement): void {
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = false;
  // Отпущенный захват иначе тут же вернул бы стартовый экран поверх оверлея.
  start.dismiss();
  stopLoop();
  // Экранное управление лежит ниже, но кнопка рюкзака выше — на белом экране
  // торчала бы одна она. Игра кончилась, убираем всё.
  document.querySelector('#touch')?.setAttribute('hidden', '');
  document.querySelector('#btn-bag')?.setAttribute('hidden', '');
}
```

Обработчик победы переписать через неё, сохранив логику кнопки «Дальше».

- [ ] **Step 3: Подключить поимку**

В цикле, сразу после `antagonist.step(...)`:

```ts
if (antagonist.caught(player)) {
  endGame(caughtEl);
  return;   // кадр досчитывать нечего
}
```

И рядом с кнопкой «Дальше»:

```ts
// Хеш сохраняется, значит перезагружается тот же уровень — тем же проверенным
// путём, которым работает «Дальше» на экране победы.
document.querySelector('#caught-again')?.addEventListener('click', () => location.reload());
```

Автоматической перезагрузки нет намеренно: экран, мигнувший на полсекунды, не объясняет игроку, что произошло, а объяснить надо — он потерял всё пройденное.

- [ ] **Step 4: Проверить**

Run: `npm test` — Expected: PASS.
Run: `npm run dev` — на `#level_03` дать себя поймать: должен появиться экран, курсор отпуститься, экранное управление исчезнуть, кнопка «Ещё раз» перезапустить тот же уровень.

- [ ] **Step 5: Коммит**

```bash
git add index.html src/main.ts
git commit -m "Экран поимки и общий endGame для победы и проигрыша"
```

---

## Task 9: Выносливость в ядре

**Files:**
- Create: `src/core/stamina.ts`
- Modify: `src/config.ts`
- Test: `src/core/stamina.test.ts`
- Test: `src/core/collision.test.ts`

**Interfaces:**
- Consumes: `PLAYER` из `config.ts`.
- Produces:
  - `export function stepStamina(value: number, draining: boolean, dt: number): number`
  - `export function canSprint(value: number, wasSprinting: boolean): boolean`
  - `PLAYER` получает `sprintSpeed: 4.5`, `sprintSeconds: 5`, `recoverSeconds: 8`, `sprintUnlock: 0.3`

- [ ] **Step 1: Написать падающий тест**

Создать `src/core/stamina.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canSprint, stepStamina } from './stamina';
import { PLAYER } from '../config';

describe('выносливость', () => {
  it('полный запас тратится ровно за sprintSeconds', () => {
    let value = 1;
    for (let i = 0; i < PLAYER.sprintSeconds / 0.016; i++) value = stepStamina(value, true, 0.016);
    expect(value).toBeCloseTo(0, 2);
  });

  it('с нуля восстанавливается за recoverSeconds', () => {
    let value = 0;
    for (let i = 0; i < PLAYER.recoverSeconds / 0.016; i++) value = stepStamina(value, false, 0.016);
    expect(value).toBeCloseTo(1, 2);
  });

  it('не уходит ниже нуля и не растёт выше единицы', () => {
    expect(stepStamina(0, true, 10)).toBe(0);
    expect(stepStamina(1, false, 10)).toBe(1);
  });

  it('стоя с включённым бегом не тратится: draining ложно', () => {
    expect(stepStamina(0.5, false, 1)).toBeGreaterThan(0.5);
  });

  it('выдохшийся не побежит, пока не наберёт порог', () => {
    // Гистерезис: бежавший продолжает, пока есть хоть что-то; выдохшийся ждёт порога.
    expect(canSprint(0.05, true)).toBe(true);
    expect(canSprint(0, true)).toBe(false);
    expect(canSprint(0.05, false)).toBe(false);
    expect(canSprint(PLAYER.sprintUnlock, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Тест столкновений на скорости спринта**

В `src/core/collision.test.ts` добавить:

```ts
/**
 * CLAUDE.md обосновывал отсутствие свипа словами «при 3 м/с и кадре 16 мс
 * смещение 5 см». На 4.5 м/с и клампе dt в 50 мс это 22 см — больше толщины
 * стены. Обрезка в resolveMove идёт по факту пересечения грани, а не по
 * попаданию внутрь, то есть свип по осям там уже есть. Проверяем, а не верим.
 */
it('на скорости спринта и максимальном шаге времени не проходит сквозь стену', () => {
  const wall = [{ x0: 1, x1: 1.2, z0: -5, z1: 5 }];
  const step = PLAYER.sprintSpeed * MAX_DELTA_SECONDS;
  const next = resolveMove({ x: 0, z: 0 }, { x: step, z: 0 }, PLAYER.radius, wall);
  expect(next.x).toBeLessThanOrEqual(1 - PLAYER.radius + 1e-9);
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run src/core/stamina.test.ts src/core/collision.test.ts`
Expected: FAIL — модуля `./stamina` нет, полей в `PLAYER` нет.

- [ ] **Step 4: Реализовать**

В `src/config.ts` дополнить `PLAYER`:

```ts
sprintSpeed: 4.5,     // против speed: 3
sprintSeconds: 5,     // полный запас = 5 с бега ≈ 22 м, две трети кольца
recoverSeconds: 8,    // с нуля до полного
sprintUnlock: 0.3,    // ниже — бежать нельзя, пока не наберётся
```

Создать `src/core/stamina.ts`:

```ts
import { PLAYER } from '../config';

/** Запас 0..1. `draining` истинно, только когда игрок И правда бежит. */
export function stepStamina(value: number, draining: boolean, dt: number): number {
  const rate = draining ? -1 / PLAYER.sprintSeconds : 1 / PLAYER.recoverSeconds;
  return Math.max(0, Math.min(1, value + rate * dt));
}

/**
 * Гистерезис. Без него на нуле игрок бежит один кадр, идёт один кадр, снова
 * бежит — дёрганый ход и мигающая полоска.
 */
export function canSprint(value: number, wasSprinting: boolean): boolean {
  return wasSprinting ? value > 0 : value >= PLAYER.sprintUnlock;
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/core/stamina.ts src/core/stamina.test.ts src/core/collision.test.ts src/config.ts
git commit -m "Выносливость: трата, восстановление и порог разблокировки"
```

---

## Task 10: Спринт в обеих схемах ввода

**Files:**
- Modify: `src/input/types.ts`
- Modify: `src/input/desktop.ts`
- Modify: `src/input/touch.ts`
- Modify: `index.html`
- Test: `src/input/scheme.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `InputState` получает `sprint: boolean`; `InputSource` получает `setSprintAvailable(available: boolean): void`.

- [ ] **Step 1: Расширить интерфейс**

В `src/input/types.ts`:

```ts
export interface InputState {
  // ...существующие поля...
  /**
   * НАМЕРЕНИЕ бежать, а не факт. На десктопе мгновенное (держат Shift), на
   * телефоне залипающее (тумблер). Решает ли оно что-нибудь — зависит от запаса
   * выносливости и от того, движется ли игрок; это считает игровой цикл.
   */
  sprint: boolean;
}
```

`emptyState()` дополнить `sprint: false`. **`consume()` его НЕ сбрасывает**: это состояние, а не фронт нажатия, в отличие от `interact` и `toggleInventory`.

В `InputSource` добавить:

```ts
  /**
   * Можно ли сейчас бежать. Тач-схема этим тускнит кнопку «Бег»; десктопная не
   * делает ничего. Намерение при этом сохраняется: тумблер не гаснет сам, чтобы
   * не требовать нового тапа ровно тогда, когда игрок убегает.
   */
  setSprintAvailable(available: boolean): void;
```

- [ ] **Step 2: Написать падающий тест**

В `src/input/scheme.test.ts` добавить:

```ts
it('Shift даёт намерение бежать и снимает его при отпускании', () => {
  const canvas = document.createElement('canvas');
  const input = createDesktopInput(canvas, () => false);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
  expect(input.state.sprint).toBe(true);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
  expect(input.state.sprint).toBe(false);
});

it('намерение переживает consume: это состояние, а не фронт нажатия', () => {
  const canvas = document.createElement('canvas');
  const input = createDesktopInput(canvas, () => false);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftRight' }));
  input.consume();
  expect(input.state.sprint).toBe(true);
});
```

Существующие тесты файла показывают, как в нём создаётся схема и рассылаются события; следовать им.

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/input/scheme.test.ts`
Expected: FAIL — поля `sprint` нет.

- [ ] **Step 4: Десктопная схема**

В `src/input/desktop.ts`, там же, где обрабатываются прочие клавиши, добавить в обработчики `keydown`/`keyup`:

```ts
// Физическая клавиша, а не символ: event.key сломался бы при смене раскладки.
state.sprint = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
```

`setSprintAvailable` — пустая реализация: на десктопе показывать нечего.

- [ ] **Step 5: Кнопка в разметке**

В `index.html`, внутри `#touch`, рядом с `#btn-use`:

```html
<button id="btn-sprint" class="touch-btn" type="button">Бег</button>
```

Стиль — правая сторона, между «Действие» и «Рюкзак»:

```css
#btn-sprint { right: calc(20px + env(safe-area-inset-right));
              bottom: calc(96px + env(safe-area-inset-bottom)); min-height: 48px; }
#btn-sprint.on { outline: 2px solid #fff; }
```

- [ ] **Step 6: Тач-схема**

В `src/input/touch.ts`:

```ts
const sprintButton = document.querySelector<HTMLButtonElement>('#btn-sprint');
if (!sprintButton) throw new Error('Разметка тач-управления не найдена.');

// Тумблер, а не удержание: правая половина экрана — свайп обзора, и удержание
// парковало бы большой палец, оставляя игрока без возможности повернуть на бегу.
sprintButton.addEventListener('click', () => {
  state.sprint = !state.sprint;
  sprintButton.classList.toggle('on', state.sprint);
});
```

`setSprintAvailable(available)` — `sprintButton.disabled = !available`. Намерение при этом не трогать.

- [ ] **Step 7: Строки на стартовом экране**

В `index.html`, в клавиатурный список управления добавить `<li>Shift — бежать</li>`, в `<ul class="for-touch">` — `<li>Кнопка «Бег» — бежать</li>`.

У этого проекта оба Critical финального ревью были «игрок не понимает, как играть». Новая механика без строки в этом списке — прямой рецидив.

- [ ] **Step 8: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Коммит**

```bash
git add src/input index.html
git commit -m "Спринт в обеих схемах ввода: Shift на десктопе, тумблер на телефоне"
```

---

## Task 11: Применение спринта и полоска выносливости

**Files:**
- Modify: `src/main.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: `stepStamina`, `canSprint` из Task 9; `state.sprint`, `setSprintAvailable` из Task 10.
- Produces: ничего для последующих задач.

- [ ] **Step 1: Полоска в разметке**

```html
<div id="stamina" hidden><div id="stamina-fill"></div></div>
```

```css
#stamina { position: fixed; left: 50%; transform: translateX(-50%);
           bottom: calc(16px + env(safe-area-inset-bottom));
           width: 180px; height: 6px; border-radius: 3px;
           background: rgba(0,0,0,0.45); z-index: 6; pointer-events: none; }
#stamina[hidden] { display: none; }
#stamina-fill { height: 100%; width: 100%; border-radius: 3px;
                background: #d8d4c8; transition: width 0.08s linear; }
```

- [ ] **Step 2: Применить спринт в цикле**

В `main.ts` рядом с прочим состоянием игрока:

```ts
let stamina = 1;
let sprinting = false;
```

Внутри ветки движения, заменив вычисление `delta`:

```ts
// Порядок важен: сначала решаем, бежит ли он в ЭТОМ кадре, потом считаем шаг
// этой скоростью, потом списываем запас. Иначе полоска и скорость расходятся
// на кадр, и на глаз это выглядит как рывок в момент, когда запас кончился.
const wantsToMove = state.move.x !== 0 || state.move.y !== 0;
sprinting = state.sprint && wantsToMove && canSprint(stamina, sprinting);
const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.speed;
stamina = stepStamina(stamina, sprinting, dt);

const delta = moveDelta(state.move, yaw, speed, dt);
```

- [ ] **Step 3: Показать полоску и погасить кнопку**

После вычисления запаса:

```ts
// Показывается только когда запас неполный: пока игрок исследует, экран чистый,
// а полоска появляется в момент первого бега и этим себя объясняет.
staminaEl.hidden = stamina >= 1;
staminaFill.style.width = `${Math.round(stamina * 100)}%`;
input.setSprintAvailable(canSprint(stamina, sprinting));
```

- [ ] **Step 4: Проверить**

Run: `npm test` — Expected: PASS.
Run: `npm run dev -- --host` — с клавиатуры: Shift ускоряет, полоска появляется и тает, на нуле скорость падает и не возвращается, пока полоска не дорастёт до трети. **С телефона: тап по «Бег» включает бег, палец при этом свободен и обзор крутится.** Проверять на реальном устройстве: DevTools врёт про мультитач и размер пальца.

- [ ] **Step 5: Коммит**

```bash
git add src/main.ts index.html
git commit -m "Спринт применяется в цикле, полоска выносливости на экране"
```

---

## Task 12: Виньетка

**Files:**
- Create: `src/ui/dread.ts`
- Modify: `index.html`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `antagonist.distanceTo(player)` и `antagonist.state` из Task 7.
- Produces: `export function createDread(): { update(distance: number | null, chasing: boolean, dt: number): void }`

- [ ] **Step 1: Разметка**

```html
<div id="dread"></div>
```

```css
#dread { position: fixed; inset: 0; z-index: 4; pointer-events: none; opacity: 0;
         background: radial-gradient(ellipse at center,
           rgba(0,0,0,0) 35%, rgba(20,0,0,0.85) 100%); }
```

`z-index: 4` — ниже экранного управления (5), чтобы кнопки не темнели.

- [ ] **Step 2: Реализовать**

Создать `src/ui/dread.ts`:

```ts
/** За этим расстоянием тревожиться не о чем. */
const RANGE = 15;

export function createDread(): { update(distance: number | null, chasing: boolean, dt: number): void } {
  const el = document.querySelector<HTMLElement>('#dread');
  if (!el) throw new Error('Разметка виньетки не найдена.');
  let pulse = 0;

  return {
    update(distance, chasing, dt) {
      if (distance === null || distance >= RANGE) { el.style.opacity = '0'; return; }
      const nearness = 1 - distance / RANGE;
      if (chasing) {
        // Пульсация — второй канал: игрок отличает «он где-то тут» от «он идёт
        // за мной», а это разные решения — затаиться или бежать.
        pulse += dt * 6;
        el.style.opacity = String(nearness * (0.75 + 0.25 * Math.sin(pulse)));
      } else {
        pulse = 0;
        el.style.opacity = String(nearness * 0.45);
      }
    },
  };
}
```

- [ ] **Step 3: Подключить**

В цикле `main.ts`, после шага антагониста:

```ts
// Расстояние по графу комнат, а не по прямой: он бывает в трёх метрах за стеной
// шахты и в двадцати метрах ходьбы, и тревожить в этот момент значит врать.
dread.update(antagonist.distanceTo(player), antagonist.state === 'chase', dt);
```

- [ ] **Step 4: Проверить**

Run: `npm test` — Expected: PASS.
Run: `npm run dev` — пройтись мимо антагониста через стену шахты: затемнения быть не должно. Подойти к нему по коридору: должно нарастать. Дать себя увидеть: должно усилиться и запульсировать.

- [ ] **Step 5: Коммит**

```bash
git add src/ui/dread.ts src/main.ts index.html
git commit -m "Виньетка: предупреждение по расстоянию в графе комнат"
```

---

## Task 13: Звук шагов

**Files:**
- Create: `src/audio/steps.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `antagonist.distanceTo(player)`, `antagonist.x/z` из Task 7; `start` (стартовый оверлей) из `main.ts`.
- Produces: `export function createSteps(): { unlock(): void; update(distance: number | null, pan: number, dt: number): void }`

Отдельная и последняя задача намеренно: это единственная часть, которую можно не довезти, не тронув ни честность, ни играбельность. Гарантия честности — виньетка из Task 12.

- [ ] **Step 1: Реализовать**

Создать `src/audio/steps.ts`:

```ts
const RANGE = 15;
const STEP_INTERVAL = 0.42;   // с, примерно шаг на 2.6 м/с

/**
 * Шаги антагониста. Файлов нет: всплеск шума через полосовой фильтр с быстрым
 * затуханием. `AudioContext` не создаётся до жеста пользователя, поэтому
 * `unlock()` зовут из клика на стартовом экране — он всё равно обязателен, чтобы
 * начать игру.
 *
 * Если контекст не создался, звука просто нет, и игра остаётся полностью
 * играбельной: предупреждает игрока виньетка, а не шаги.
 */
export function createSteps(): {
  unlock(): void;
  update(distance: number | null, pan: number, dt: number): void;
} {
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let sinceStep = 0;

  function unlock(): void {
    if (ctx) { void ctx.resume(); return; }
    try {
      ctx = new AudioContext();
      const frames = Math.floor(ctx.sampleRate * 0.12);
      noise = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;   // Звука не будет. Это не ошибка игры.
    }
  }

  function play(volume: number, pan: number): void {
    if (!ctx || !noise) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(filter).connect(gain).connect(panner).connect(ctx.destination);
    source.start();
  }

  return {
    unlock,
    update(distance, pan, dt) {
      if (distance === null || distance >= RANGE) return;
      sinceStep += dt;
      if (sinceStep < STEP_INTERVAL) return;
      sinceStep = 0;
      play(0.35 * (1 - distance / RANGE), pan);
    },
  };
}
```

- [ ] **Step 2: Подключить**

Разблокировка — там же, где стартовый экран обрабатывает нажатие «Нажми, чтобы начать»: добавить вызов `steps.unlock()`.

В цикле, рядом с виньеткой:

```ts
// Панорама по углу между взглядом игрока и направлением на антагониста:
// «шаги слева» получаются одной строкой.
const toHim = Math.atan2(antagonist.x - player.x, antagonist.z - player.z);
const relative = Math.atan2(Math.sin(toHim - yaw), Math.cos(toHim - yaw));
steps.update(antagonist.distanceTo(player), -Math.sin(relative), dt);
```

- [ ] **Step 3: Проверить**

Run: `npm test` — Expected: PASS.
Run: `npm run dev -- --host` — в наушниках: шаги слышны, сторона совпадает с тем, где он на самом деле. **Проверить с выключенным звуком на телефоне: игра обязана оставаться проходимой** — за предупреждение отвечает виньетка.

- [ ] **Step 4: Коммит**

```bash
git add src/audio/steps.ts src/main.ts
git commit -m "Шаги антагониста: процедурный звук с панорамой"
```

---

## Task 14: Документация

**Files:**
- Modify: `CLAUDE.md`
- Modify: `known-issues.md`
- Modify: `.superpowers/sdd/2026-08-24-bandy-vertical-slice/progress.md`

**Interfaces:**
- Consumes: всё сделанное.
- Produces: ничего для кода.

- [ ] **Step 1: `CLAUDE.md`**

Добавить раздел про антагониста: где живёт код, что `core/` по-прежнему без three.js, что блок в JSON необязателен, что кольцо нельзя запирать, и что все шесть констант настраиваются только руками на телефоне.

Поправить фразу «Референс по духу — Hello Neighbor, но антагониста в первой версии нет.»

Поправить обоснование отсутствия свипа: «при 3 м/с и кадре 16 мс смещение 5 см» — теперь скорость 4.5, а обрезка в `resolveMove` идёт по пересечению грани, и это проверено тестом.

- [ ] **Step 2: `known-issues.md`**

Записать то, что осознанно отложено спекой §15: шкафы, слух антагониста, отложенное появление, второй антагонист, отвлекающие предметы. Каждую запись — с причиной, а не списком желаний.

Убрать запись про «проёма без двери нет» из отложенных, если поведение антагониста сделало её неактуальной, либо дописать, как оно с ней уживается.

- [ ] **Step 3: Журнал работ**

Дописать в `progress.md`: что решено и почему, с ценой ошибки. Обязательно — три места, где рассуждение оказалось неверным и было исправлено при проектировании: выпуклость применялась к точке, а не к телу; `keepOpen` обосновывался несуществующей проверкой валидатора; правило связности обхода отвергало собственный третий уровень, пока в него не добавили оговорку про замки.

```bash
git add -f .superpowers/sdd/2026-08-24-bandy-vertical-slice/progress.md
```

- [ ] **Step 4: Финальная проверка**

Run: `npm test` — Expected: PASS.
Run: `npm run build` — Expected: собирается.
Run: `npm run dev -- --host` — пройти третий уровень целиком **с клавиатуры и с телефона**, включая поимку и перезапуск.

- [ ] **Step 5: Коммит**

```bash
git add CLAUDE.md known-issues.md
git commit -m "Документация: антагонист, спринт, отложенное"
```
