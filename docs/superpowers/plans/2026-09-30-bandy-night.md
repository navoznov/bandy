# Ночной режим (уровень 4) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Четвёртый уровень в духе FNAF по рисунку сына: игрок сидит в офисе, смотрит камеры, закрывает две двери и заслонку вентиляции и держится до 6 AM, пока четыре монстра прыгают по своим маршрутам.

**Architecture:** Логика ночи — чистое ядро `src/core/night.ts` без three.js, с внешним генератором случайных чисел, поэтому целиком покрыта тестами. Уровень описывается блоком `night` в JSON, валидатор проверяет его восемью правилами. `main.ts` делится: общее (ловушки ошибок, загрузка уровня, рендерер) остаётся в нём, цикл ходьбы переезжает в `src/explore.ts`, ночной цикл живёт в `src/night/`. Уровни 1–3 не меняются.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), three.js 0.185, Vite, Vitest, Web Audio.

**Spec:** `docs/superpowers/specs/2026-09-30-bandy-night-design.md` — читать целиком перед любой задачей. Также `CLAUDE.md` в корне.

## Global Constraints

- `src/core/` не импортирует three.js. Никогда.
- Хоткеи читаются только через `event.code`, никогда через `event.key`.
- Шаг времени клампится `MAX_DELTA_SECONDS` (0.05 с) в каждом кадре.
- Экранные кнопки офиса — не меньше 96×64 CSS px, реагируют на `pointerdown`, `touch-action: none`.
- `npm test` (это `tsc --noEmit` и затем весь Vitest) зелёный после каждой задачи.
- Уровни 1–3 ведут себя ровно как до этой работы.
- Сообщения валидатора называют сущности идентификаторами (`d_office_w`), а не человеческими названиями.
- Коммиты — на русском, как в истории репозитория, **без** строк `Co-Authored-By` и пометок «Generated with Claude Code».
- Работа идёт в ветке `feature/level-04`, в `main` — только через PR.
- Все числа ночи живут в `NIGHT` в `src/config.ts`; в коде их литералами не дублировать.

## Review Focus

1. **Телефон повернули в портрет посреди ночи** — поверх игры встаёт «Поверни телефон», и часы ночи в это время стоят. Иначе игрок теряет ночь, пока крутит телефон. Тест `nightTicks` в задаче 5.
2. **Вкладка ушла в фон и вернулась**: rAF стоит, первый кадр после возврата приносит большой dt. Цикл клампит dt, а ядро при dt больше периода бросков делает все положенные броски, а не один. Тест «большой шаг» в задаче 2.
3. **Клавиша или тап до старта и при поднятом мониторе.** Первое нажатие только снимает стартовый экран и не закрывает дверь. Q при поднятом мониторе ничего не делает и не тратит энергию. Тест отказа в задаче 2, `stopPropagation` старта в задаче 5.
4. **Пробел.** Он не прокручивает страницу и не жмёт кнопку, на которой стоит фокус, второй раз. Отсюда `preventDefault` и `tabindex="-1"` у кнопок. Тест `keyAction` в задаче 5.
5. **Два монстра у одной двери** (красный и оранжевый справа). Каждый отражается закрытой заслонкой на своём броске, независимо от другого. Тест в задаче 2.

---

## Карта файлов

| Файл | Что делает | Задача |
|---|---|---|
| `src/core/types.ts` | `NightDef`, `NightMonster`, `NightCamera`, `RoutePoint`, `ShutterSide`, `SHUTTER_SIDES`; `Level.night?` | 1 |
| `src/core/validate.ts` | `parseNight`, `checkNight`; для ночного уровня выключена проверка выхода | 1 |
| `src/config.ts` | `NIGHT` | 2 |
| `src/core/night.ts` | Класс `Night`: часы, энергия, заслонки, свет, монитор, монстры, события | 2 |
| `src/levels/level_04.json` | Уровень по рисунку | 3 |
| `src/levels/index.ts` | `level_04` в реестре после `level_03` | 3 |
| `src/context.ts` | `RunContext` — общее для обоих режимов | 4 |
| `src/explore.ts` | Цикл ходьбы, перенесённый из `main.ts` без изменений | 4 |
| `src/main.ts` | Общая часть и развилка `night` / исследование | 4 |
| `src/render/scene.ts` | Опции `doorLeaves`, `ambient` | 4 |
| `src/render/antagonist.ts` | Параметр цвета меша | 4 |
| `src/night/pose.ts` | Поза монстра и правило видимости из офиса — чистые функции | 4 |
| `src/night/scene.ts` | Шторки, лампы в проёмах, помост и стол, меши монстров | 4 |
| `src/night/run.ts` | Ночной цикл | 4–7 |
| `src/night/input.ts` | Хоткеи, поворот головы у края экрана и свайпом | 5 |
| `src/night/hud.ts` | Кнопки, часы, энергия | 5 |
| `src/night/start.ts` | Стартовый экран ночи | 5 |
| `src/night/map.ts` | Раскладка карты камер — чистая функция | 6 |
| `src/night/monitor.ts` | Оверлей монитора: зерно, REC, CAM, карта | 6 |
| `src/audio/night.ts` | Лязг заслонки, крик, колокольчик | 7 |
| `src/night/jumpscare.ts` | Скример | 7 |
| `index.html` | Разметка и стили ночи | 5–7 |
| `CLAUDE.md`, `known-issues.md` | Документация | 8 |

---

### Task 1: Типы и валидатор блока `night`

**Files:**
- Modify: `src/core/types.ts` (после `AntagonistDef`, и поле в `Level`)
- Modify: `src/core/validate.ts`
- Test: `src/core/validate.test.ts` (новый `describe` в конце файла)

**Interfaces:**
- Produces:
  - `export const SHUTTER_SIDES = ['left', 'vent', 'right'] as const;`
  - `export type ShutterSide = 'left' | 'vent' | 'right';`
  - `export interface RoutePoint { room: string; at: readonly [number, number] }`
  - `export interface NightCamera { id: string; room: string; at: readonly [number, number]; look: readonly [number, number] }`
  - `export interface NightMonster { id: string; color: string; aggression: number; door: ShutterSide; route: RoutePoint[] }`
  - `export interface NightDef { office: string; shutters: Record<ShutterSide, string>; stage?: Rect; cameras: NightCamera[]; monsters: NightMonster[] }`
  - `Level.night?: NightDef`

- [ ] **Step 1: Добавить типы**

В `src/core/types.ts` сразу после `interface AntagonistDef { ... }`:

```ts
/** Проёмы офиса, которые игрок закрывает. Порядок — порядок кнопок слева направо. */
export const SHUTTER_SIDES = ['left', 'vent', 'right'] as const;
export type ShutterSide = typeof SHUTTER_SIDES[number];

/** Точка маршрута ночного монстра. Комната названа явно: опечатку в ней валидатор ловит по имени. */
export interface RoutePoint {
  room: string;
  at: readonly [number, number];
}

export interface NightCamera {
  /** Номер на карте монитора, как на рисунке: "1".."9". */
  id: string;
  room: string;
  /** Где висит под потолком. */
  at: readonly [number, number];
  /** Куда смотрит объектив — точка на полу. */
  look: readonly [number, number];
}

export interface NightMonster {
  id: string;
  color: string;
  /** 0..20. Шанс прыжка на каждом броске — aggression / 20, как в оригинале. */
  aggression: number;
  /** У какой заслонки кончается маршрут. */
  door: ShutterSide;
  /** Первая точка — старт, последняя — у заслонки. После заслонки — снова первая. */
  route: RoutePoint[];
}

export interface NightDef {
  office: string;
  shutters: Record<ShutterSide, string>;
  /** Низкий помост сцены. Монстр, чья точка внутри, стоит на нём. */
  stage?: Rect;
  cameras: NightCamera[];
  /** Первый в списке приходит, когда кончилась энергия. */
  monsters: NightMonster[];
}
```

В `interface Level` после `antagonist?: AntagonistDef;`:

```ts
  /** Уровень в ночном режиме: игрок сидит в офисе. Несовместим с `antagonist`. */
  night?: NightDef;
```

- [ ] **Step 2: Написать падающие тесты**

В конец `src/core/validate.test.ts`:

```ts
/**
 * Минимальный ночной уровень: зал сверху, под ним три комнаты, офис между ними.
 *
 *   hall   [0,0,7,4]
 *   west   [0,4,2,4]  vent [3,4,1,2]  east [5,4,2,4]
 *                office [2,6,3,2]
 */
function nightLevel() {
  return {
    id: 'night_test',
    spawn: { room: 'office', x: 3.5, z: 7, yaw: 0 },
    rooms: [
      { id: 'hall', rect: [0, 0, 7, 4], color: '#555555', light: 0.5 },
      { id: 'west', rect: [0, 4, 2, 4], color: '#555555', light: 0.5 },
      { id: 'vent', rect: [3, 4, 1, 2], color: '#555555', light: 0.5 },
      { id: 'east', rect: [5, 4, 2, 4], color: '#555555', light: 0.5 },
      { id: 'office', rect: [2, 6, 3, 2], color: '#555555', light: 0.5 },
    ],
    doors: [
      { id: 'd_west', between: ['hall', 'west'], at: [1, 4] },
      { id: 'd_vent', between: ['hall', 'vent'], at: [3.5, 4] },
      { id: 'd_east', between: ['hall', 'east'], at: [6, 4] },
      { id: 'dl', between: ['west', 'office'], at: [2, 7] },
      { id: 'dv', between: ['vent', 'office'], at: [3.5, 6] },
      { id: 'dr', between: ['office', 'east'], at: [5, 7] },
    ],
    night: {
      office: 'office',
      shutters: { left: 'dl', vent: 'dv', right: 'dr' } as Record<string, string>,
      stage: [1, 0, 3, 1],
      cameras: [{ id: '1', room: 'hall', at: [1, 1], look: [3, 3] }],
      monsters: [{
        id: 'red', color: '#c0302a', aggression: 6 as number, door: 'left',
        route: [{ room: 'hall', at: [2, 2] }, { room: 'west', at: [1, 7] }],
      }],
    },
  };
}

function nightErrors(mutate: (lvl: ReturnType<typeof nightLevel>) => void): string {
  const lvl = nightLevel();
  mutate(lvl);
  const result = validateLevel(lvl, itemDefs);
  return result.ok ? '' : result.errors.join('\n');
}

describe('блок night', () => {
  it('принимает ночной уровень без выхода', () => {
    expect(nightErrors(() => {})).toBe('');
  });

  it('тот же уровень без night отвергается как непроходимый', () => {
    const errors = nightErrors((l) => { delete (l as Record<string, unknown>)['night']; });
    expect(errors).toContain('непроходим');
  });

  describe('форма', () => {
    it('night не объект', () => {
      expect(nightErrors((l) => { (l as Record<string, unknown>)['night'] = 5; }))
        .toContain('Поле "night" должно быть объектом');
    });
    it('в shutters нет vent', () => {
      expect(nightErrors((l) => { delete l.night.shutters['vent']; })).toContain('"shutters"');
    });
    it('door не из left/vent/right', () => {
      expect(nightErrors((l) => { l.night.monsters[0]!.door = 'up'; })).toContain('"door"');
    });
    it('aggression больше 20', () => {
      expect(nightErrors((l) => { l.night.monsters[0]!.aggression = 21; })).toContain('"aggression"');
    });
    it('aggression дробная', () => {
      expect(nightErrors((l) => { l.night.monsters[0]!.aggression = 2.5; })).toContain('"aggression"');
    });
    it('color не hex', () => {
      expect(nightErrors((l) => { l.night.monsters[0]!.color = 'red'; })).toContain('"color"');
    });
  });

  describe('правило 1: офис', () => {
    it('офиса не существует', () => {
      expect(nightErrors((l) => { l.night.office = 'nope'; })).toContain('офиса "nope"');
    });
    it('игрок появляется не в офисе', () => {
      expect(nightErrors((l) => { l.spawn = { room: 'hall', x: 1, z: 1, yaw: 0 }; }))
        .toContain('а не в офисе');
    });
  });

  describe('правило 2: заслонки', () => {
    it('двери заслонки не существует', () => {
      expect(nightErrors((l) => { l.night.shutters['left'] = 'nope'; })).toContain('двери "nope"');
    });
    it('заслонка не ведёт в офис', () => {
      expect(nightErrors((l) => { l.night.shutters['left'] = 'd_west'; })).toContain('не ведёт в офис');
    });
    it('одна дверь назначена двумя заслонками', () => {
      expect(nightErrors((l) => { l.night.shutters['right'] = 'dl'; }))
        .toContain('назначена заслонкой дважды');
    });
    it('у офиса есть дверь, которая не заслонка', () => {
      const errors = nightErrors((l) => {
        l.rooms.push({ id: 'south', rect: [2, 8, 3, 2], color: '#555555', light: 0.5 });
        l.doors.push({ id: 'd_south', between: ['office', 'south'], at: [3.5, 8] });
      });
      expect(errors).toContain('"d_south", которая не заслонка');
    });
  });

  describe('правило 3: камеры', () => {
    it('нет ни одной камеры', () => {
      expect(nightErrors((l) => { l.night.cameras = []; })).toContain('нет ни одной камеры');
    });
    it('камера объявлена дважды', () => {
      expect(nightErrors((l) => { l.night.cameras.push({ ...l.night.cameras[0]! }); }))
        .toContain('камера "1" объявлена дважды');
    });
    it('камера вне своей комнаты', () => {
      expect(nightErrors((l) => { l.night.cameras[0]!.at = [6, 6]; })).toContain('стоит вне комнаты');
    });
    it('камера смотрит в свою же точку', () => {
      expect(nightErrors((l) => { l.night.cameras[0]!.look = [1, 1]; })).toContain('смотрит в точку');
    });
  });

  describe('правило 4: монстры', () => {
    it('нет ни одного монстра', () => {
      expect(nightErrors((l) => { l.night.monsters = []; })).toContain('нет ни одного монстра');
    });
    it('монстр объявлен дважды', () => {
      expect(nightErrors((l) => { l.night.monsters.push({ ...l.night.monsters[0]! }); }))
        .toContain('монстр "red" объявлен дважды');
    });
    it('в маршруте одна точка', () => {
      expect(nightErrors((l) => { l.night.monsters[0]!.route.splice(0, 1); })).toContain('меньше двух');
    });
    it('точка вне своей комнаты', () => {
      expect(nightErrors((l) => { l.night.monsters[0]!.route[0]!.at = [6, 6]; }))
        .toContain('точка 1 лежит вне комнаты');
    });
    it('точка в офисе', () => {
      expect(nightErrors((l) => { l.night.monsters[0]!.route[0] = { room: 'office', at: [3, 7] }; }))
        .toContain('лежит в офисе');
    });
  });

  it('правило 5: маршрут кончается не за своей заслонкой', () => {
    expect(nightErrors((l) => { l.night.monsters[0]!.door = 'right'; }))
      .toContain('кончается в комнате "west", а заслонка "right" ведёт в "east"');
  });

  it('правило 7: помост вылезает из комнаты', () => {
    expect(nightErrors((l) => { l.night.stage = [5, 0, 4, 1]; })).toContain('помост');
  });

  it('правило 8: night и antagonist вместе', () => {
    const errors = nightErrors((l) => {
      (l as Record<string, unknown>)['antagonist'] = {
        spawn: { room: 'hall', x: 2, z: 2 }, route: ['hall', 'west'], keepOpen: [],
      };
    });
    expect(errors).toContain('несовместимы');
  });
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run src/core/validate.test.ts`
Expected: FAIL — «принимает ночной уровень без выхода» получает «Уровень непроходим…», тесты правил не находят своих сообщений.

- [ ] **Step 4: Реализовать разбор формы**

В `src/core/validate.ts` расширить импорт типов: `NightDef, ShutterSide` в `import type { ... }` и `SHUTTER_SIDES` рядом с `ROOM_STYLES`:

```ts
import { ROOM_STYLES, SHUTTER_SIDES } from './types';
```

После функции `parseAntagonist` добавить:

```ts
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPoint(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every(isFiniteNumber);
}

/**
 * Блок `night`: только форма. Как и `antagonist`, разбирается до смысловых
 * проверок: битая форма отбрасывает сущность, и ссылки на неё дали бы ложные
 * «не существует» поверх одной настоящей ошибки.
 */
function parseNight(raw: unknown, errors: string[]): NightDef | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    errors.push('Поле "night" должно быть объектом.');
    return undefined;
  }
  let valid = true;
  const fail = (text: string): void => {
    errors.push(`Ночь: ${text}`);
    valid = false;
  };

  if (!isNonEmptyString(raw['office'])) fail('поле "office" должно быть непустой строкой.');

  const shutters = raw['shutters'];
  if (!isRecord(shutters) || !SHUTTER_SIDES.every((side) => isNonEmptyString(shutters[side]))) {
    fail(`поле "shutters" должно содержать строки ${SHUTTER_SIDES.map((s) => `"${s}"`).join(', ')}.`);
  }

  const stage = raw['stage'];
  if (stage !== undefined && !(Array.isArray(stage) && stage.length === 4 && stage.every(isFiniteNumber))) {
    fail('поле "stage" должно быть прямоугольником [x, z, w, d].');
  }

  const cameras = raw['cameras'];
  if (!Array.isArray(cameras) || !cameras.every((c) => isRecord(c)
    && isNonEmptyString(c['id']) && isNonEmptyString(c['room']) && isPoint(c['at']) && isPoint(c['look']))) {
    fail('поле "cameras" должно быть массивом { id, room, at: [x, z], look: [x, z] }.');
  }

  const monsters = raw['monsters'];
  if (!Array.isArray(monsters)) {
    fail('поле "monsters" должно быть массивом.');
  } else {
    for (const m of monsters) {
      if (!isRecord(m) || !isNonEmptyString(m['id'])) {
        fail('у монстра нет поля "id".');
        continue;
      }
      const label = `монстр "${m['id']}"`;
      const color = m['color'];
      if (!isNonEmptyString(color) || !COLOR_RE.test(color)) fail(`${label}: "color" должен быть цветом вида #rrggbb.`);
      const aggression = m['aggression'];
      if (typeof aggression !== 'number' || !Number.isInteger(aggression) || aggression < 0 || aggression > 20) {
        fail(`${label}: "aggression" должна быть целым числом от 0 до 20.`);
      }
      if (!(SHUTTER_SIDES as readonly unknown[]).includes(m['door'])) {
        fail(`${label}: "door" должен быть одним из ${SHUTTER_SIDES.join(', ')}.`);
      }
      const route = m['route'];
      if (!Array.isArray(route) || !route.every((p) => isRecord(p) && isNonEmptyString(p['room']) && isPoint(p['at']))) {
        fail(`${label}: "route" должен быть массивом { room, at: [x, z] }.`);
      }
    }
  }

  if (!valid) return undefined;
  // Форма проверена поле за полем выше; приведение только фиксирует этот факт для типов.
  return raw as unknown as NightDef;
}
```

- [ ] **Step 5: Реализовать смысловые правила**

Там же, после `parseNight`:

```ts
/** Правила спеки ночи §6. Сообщения — по идентификаторам: их читает автор карты. */
function checkNight(
  night: NightDef,
  byId: Map<string, RoomDef>,
  doors: DoorDef[],
  spawn: Level['spawn'] | undefined,
  hasAntagonist: boolean,
  errors: string[],
): void {
  // Правило 8.
  if (hasAntagonist) errors.push('Ночь: блоки "night" и "antagonist" на одном уровне несовместимы.');

  // Правило 1.
  if (!byId.has(night.office)) errors.push(`Ночь: комнаты офиса "${night.office}" не существует.`);
  if (spawn && spawn.room !== night.office) {
    errors.push(`Ночь: игрок появляется в комнате "${spawn.room}", а не в офисе "${night.office}".`);
  }

  // Правило 2. Заодно запоминаем комнату по ту сторону каждой заслонки — к ней
  // привязано правило 5.
  const beyond = new Map<ShutterSide, string>();
  const shutterIds = new Set<string>();
  for (const side of SHUTTER_SIDES) {
    const id = night.shutters[side];
    if (shutterIds.has(id)) errors.push(`Ночь: дверь "${id}" назначена заслонкой дважды.`);
    shutterIds.add(id);
    const door = doors.find((d) => d.id === id);
    if (!door) {
      errors.push(`Ночь: заслонки "${side}" — двери "${id}" — не существует.`);
      continue;
    }
    const [a, b] = door.between;
    if (a !== night.office && b !== night.office) {
      errors.push(`Ночь: заслонка "${side}" — дверь "${id}" — не ведёт в офис "${night.office}".`);
      continue;
    }
    beyond.set(side, a === night.office ? b : a);
  }
  for (const door of doors) {
    if (!door.between.includes(night.office) || shutterIds.has(door.id)) continue;
    errors.push(
      `Ночь: у офиса есть дверь "${door.id}", которая не заслонка, — через неё монстр вошёл бы беспрепятственно.`,
    );
  }

  // Правило 7.
  if (night.stage) {
    const [x, z, w, d] = night.stage;
    const host = [...byId.values()].some((room) => contains(room, x, z) && contains(room, x + w, z + d));
    if (!host) errors.push('Ночь: помост "stage" не лежит целиком внутри одной комнаты.');
  }

  // Правило 3.
  if (night.cameras.length === 0) errors.push('Ночь: нет ни одной камеры — монитору нечего показывать.');
  const cameraIds = new Set<string>();
  for (const cam of night.cameras) {
    if (cameraIds.has(cam.id)) errors.push(`Ночь: камера "${cam.id}" объявлена дважды.`);
    cameraIds.add(cam.id);
    const room = byId.get(cam.room);
    if (!room) {
      errors.push(`Ночь: камера "${cam.id}" висит в несуществующей комнате "${cam.room}".`);
      continue;
    }
    if (!contains(room, cam.at[0], cam.at[1])) errors.push(`Ночь: камера "${cam.id}" стоит вне комнаты "${cam.room}".`);
    if (Math.abs(cam.at[0] - cam.look[0]) < EPS && Math.abs(cam.at[1] - cam.look[1]) < EPS) {
      errors.push(`Ночь: камера "${cam.id}" смотрит в точку, где висит сама.`);
    }
  }

  // Правила 4 и 5. Хотя бы один монстр нужен: первый приходит при нуле энергии.
  if (night.monsters.length === 0) errors.push('Ночь: нет ни одного монстра.');
  const monsterIds = new Set<string>();
  for (const m of night.monsters) {
    if (monsterIds.has(m.id)) errors.push(`Ночь: монстр "${m.id}" объявлен дважды.`);
    monsterIds.add(m.id);
    if (m.route.length < 2) {
      errors.push(`Ночь: у монстра "${m.id}" в маршруте меньше двух точек.`);
      continue;
    }
    m.route.forEach((p, i) => {
      const room = byId.get(p.room);
      if (!room) {
        errors.push(`Ночь: монстр "${m.id}", точка ${i + 1}: комнаты "${p.room}" не существует.`);
      } else if (!contains(room, p.at[0], p.at[1])) {
        errors.push(`Ночь: монстр "${m.id}", точка ${i + 1} лежит вне комнаты "${p.room}".`);
      }
      if (p.room === night.office) {
        errors.push(`Ночь: монстр "${m.id}", точка ${i + 1} лежит в офисе — туда он попадает только через заслонку.`);
      }
    });
    const last = m.route[m.route.length - 1]!;
    const expected = beyond.get(m.door);
    if (expected !== undefined && last.room !== expected) {
      errors.push(
        `Ночь: маршрут монстра "${m.id}" кончается в комнате "${last.room}", ` +
        `а заслонка "${m.door}" ведёт в "${expected}".`,
      );
    }
  }
}
```

- [ ] **Step 6: Подключить в `validateLevel`**

После `const antagonist = parseAntagonist(lvl['antagonist'], errors);`:

```ts
  const night = parseNight(lvl['night'], errors);
```

Заменить проверку победы:

```ts
    if (!isWinReachable(reach, triggers, doors, items, interactions)) {
```

на

```ts
    // Ночной уровень выхода не имеет по замыслу: победа там — 6 AM, а не дверь.
    if (!night && !isWinReachable(reach, triggers, doors, items, interactions)) {
```

Сразу перед финальным `if (errors.length > 0) return { ok: false, errors };` (после блока `if (antagonist) { ... }`):

```ts
  if (night) checkNight(night, byId, doors, spawn, antagonist !== undefined, errors);
```

В возвращаемом объекте уровня дописать `night` после `antagonist`:

```ts
      rooms, doors, items, triggers, interactions, itemDefs, locks: lockNames, antagonist, night,
```

- [ ] **Step 7: Прогнать тесты**

Run: `npm test`
Expected: PASS, в том числе все старые тесты валидатора и уровней 1–3.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/core/validate.ts src/core/validate.test.ts
git commit -m "Валидатор: блок night для ночного уровня"
```

---

### Task 2: Ядро ночи `core/night.ts`

**Files:**
- Modify: `src/config.ts` (в конец)
- Create: `src/core/night.ts`
- Test: `src/core/night.test.ts`

**Interfaces:**
- Consumes: `NightDef`, `NightMonster`, `RoutePoint`, `ShutterSide` из задачи 1.
- Produces:
  - `NIGHT` в `src/config.ts` (поля ниже).
  - `export type LightSide = 'left' | 'right'`
  - `export type NightStatus = 'running' | 'blackout' | 'caught' | 'won'`
  - `export type NightEvent = { kind: 'moved'; monster: string; from: RoutePoint; to: RoutePoint } | { kind: 'repelled'; monster: string; side: ShutterSide } | { kind: 'blackout' } | { kind: 'caught'; monster: string } | { kind: 'won' }`
  - `export interface NightTuning { hourSeconds; hours; drainPerBar; opportunitySeconds; blackoutMin; blackoutMax; staticSeconds }` (все `number`)
  - `export class Night` — `constructor(def: NightDef, rng: () => number, tuning?: NightTuning)`; поля `time`, `power`, `status`, `monitorUp`, `camera`; геттеры `hour`, `staticLeft`; методы `on(listener)`, `bars()`, `isClosed(side)`, `isLit(side)`, `pointIndex(id)`, `pointOf(id)`, `atDoor(id)`, `toggleShutter(side): boolean`, `toggleLight(side): boolean`, `toggleMonitor(): boolean`, `selectCamera(id): boolean`, `step(dt)`.

- [ ] **Step 1: Константы**

В конец `src/config.ts`:

```ts
/**
 * Ночной режим (уровень 4). Как и ANTAGONIST — настройка игры, а не свойство
 * карты, и как и там, донастраивается только руками на устройстве.
 */
export const NIGHT = {
  hourSeconds: 60,        // 12 AM → 6 AM за 6 минут
  hours: 6,
  drainPerBar: 0.1,       // % энергии в секунду на одну полоску, как в оригинале
  opportunitySeconds: 5,  // как часто каждый монстр бросает кубик
  blackoutMin: 5,         // с от нуля энергии до поимки
  blackoutMax: 20,
  staticSeconds: 1,       // помехи на камере, когда монстр входит или выходит
  lookLimit: 1.2217,      // ±70° поворота головы в офисе, радианы
  panSpeed: 1.6,          // рад/с, когда курсор у самого края экрана
  cameraHeight: 2.6,      // м — камеры висят под потолком
  stageHeight: 0.4,       // м — высота помоста
  shutterSeconds: 0.3,    // ход шторки
  ambient: 0.5,           // общий свет вместо 2.6 в исследовании: пиццерия ночью
} as const;
```

- [ ] **Step 2: Написать падающие тесты**

`src/core/night.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NIGHT } from '../config';
import { Night, type NightEvent } from './night';
import type { NightDef, NightMonster } from './types';

/** При aggression > 0 любой бросок успешен. */
const HIT = (): number => 0;
/** При aggression < 20 ни один бросок не успешен. */
const MISS = (): number => 0.999;

function monster(over: Partial<NightMonster> = {}): NightMonster {
  return {
    id: 'red', color: '#c0302a', aggression: 20, door: 'right',
    route: [{ room: 'hall', at: [1, 1] }, { room: 'side', at: [2, 2] }],
    ...over,
  };
}

function def(monsters: NightMonster[] = [monster()]): NightDef {
  return {
    office: 'office',
    shutters: { left: 'dl', vent: 'dv', right: 'dr' },
    cameras: [
      { id: '1', room: 'hall', at: [1, 1], look: [2, 2] },
      { id: '2', room: 'side', at: [1, 1], look: [2, 2] },
      { id: '3', room: 'other', at: [1, 1], look: [2, 2] },
    ],
    monsters,
  };
}

function record(night: Night): NightEvent[] {
  const events: NightEvent[] = [];
  night.on((event) => events.push(event));
  return events;
}

const calm = (): Night => new Night(def([monster({ aggression: 0 })]), MISS);

describe('часы', () => {
  it('6 AM ровно через 360 с, и победа сообщается один раз', () => {
    const night = calm();
    const events = record(night);
    for (let i = 0; i < 359; i++) night.step(1);
    expect(night.status).toBe('running');
    expect(night.hour).toBe(5);
    night.step(1);
    night.step(1);
    expect(night.status).toBe('won');
    expect(events.filter((e) => e.kind === 'won')).toHaveLength(1);
  });

  it('час считается от начала ночи: 125 с — это 2 AM', () => {
    const night = calm();
    night.step(125);
    expect(night.hour).toBe(2);
  });
});

describe('энергия', () => {
  it('в покое горит одна полоска: 0.1 % в секунду', () => {
    const night = calm();
    night.step(10);
    expect(night.bars()).toBe(1);
    expect(night.power).toBeCloseTo(99);
  });

  it('заслонка, свет и монитор — по полоске каждый', () => {
    const night = calm();
    night.toggleShutter('left');
    night.toggleLight('right');
    night.toggleMonitor(); // гасит свет: поднятие монитора выключает оба фонаря
    expect(night.bars()).toBe(3);
    night.toggleMonitor();
    night.toggleLight('right');
    night.toggleShutter('vent');
    expect(night.bars()).toBe(4);
    night.step(10);
    expect(night.power).toBeCloseTo(96);
  });
});

describe('монитор', () => {
  it('пока поднят, заслонки и свет не нажимаются и энергию не тратят', () => {
    const night = calm();
    night.toggleMonitor();
    expect(night.toggleShutter('left')).toBe(false);
    expect(night.toggleLight('left')).toBe(false);
    expect(night.isClosed('left')).toBe(false);
    expect(night.isLit('left')).toBe(false);
    expect(night.bars()).toBe(2);
  });

  it('поднятие монитора гасит свет', () => {
    const night = calm();
    night.toggleLight('left');
    night.toggleMonitor();
    expect(night.isLit('left')).toBe(false);
  });

  it('неизвестную камеру выбрать нельзя', () => {
    const night = calm();
    expect(night.selectCamera('9')).toBe(false);
    expect(night.camera).toBe('1');
    expect(night.selectCamera('2')).toBe(true);
    expect(night.camera).toBe('2');
  });
});

describe('монстры', () => {
  it('прыгают раз в 5 секунд при удачном броске', () => {
    const night = new Night(def(), HIT);
    const events = record(night);
    night.step(4);
    expect(night.pointIndex('red')).toBe(0);
    night.step(1);
    expect(night.pointOf('red').room).toBe('side');
    expect(night.atDoor('red')).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'moved', monster: 'red' }));
  });

  it('при неудачном броске стоят', () => {
    const night = new Night(def([monster({ aggression: 10 })]), MISS);
    night.step(60);
    expect(night.pointIndex('red')).toBe(0);
  });

  // Review Focus 2: вкладка вернулась из фона, кадр принёс больше одного периода.
  it('большой шаг делает все положенные броски, а не один', () => {
    const route = [
      { room: 'hall', at: [1, 1] as const },
      { room: 'hall', at: [2, 2] as const },
      { room: 'side', at: [3, 3] as const },
    ];
    const night = new Night(def([monster({ route })]), HIT);
    night.step(10);
    expect(night.pointIndex('red')).toBe(2);
  });

  it('у закрытой заслонки уходит на старт', () => {
    const night = new Night(def(), HIT);
    const events = record(night);
    night.step(5);
    night.toggleShutter('right');
    night.step(5);
    expect(night.status).toBe('running');
    expect(night.pointIndex('red')).toBe(0);
    expect(events).toContainEqual({ kind: 'repelled', monster: 'red', side: 'right' });
  });

  it('у открытой заслонки ловит, и после этого время стоит', () => {
    const night = new Night(def(), HIT);
    const events = record(night);
    night.step(5);
    night.step(5);
    expect(night.status).toBe('caught');
    expect(events).toContainEqual({ kind: 'caught', monster: 'red' });
    const frozen = night.time;
    night.step(5);
    expect(night.time).toBe(frozen);
  });

  it('закрытая заслонка с другой стороны не спасает', () => {
    const night = new Night(def(), HIT);
    night.step(5);
    night.toggleShutter('left');
    night.step(5);
    expect(night.status).toBe('caught');
  });

  // Review Focus 5: красный и оранжевый приходят к одной двери.
  it('два монстра у одной закрытой заслонки отражаются оба', () => {
    const night = new Night(def([monster(), monster({ id: 'orange' })]), HIT);
    night.step(5);
    night.toggleShutter('right');
    night.step(5);
    expect(night.status).toBe('running');
    expect(night.pointIndex('red')).toBe(0);
    expect(night.pointIndex('orange')).toBe(0);
  });
});

describe('конец энергии', () => {
  const hungry = { ...NIGHT, drainPerBar: 100 };

  it('заслонки открываются, монитор падает, кнопки мертвы, затем поимка первым монстром', () => {
    const night = new Night(def([monster(), monster({ id: 'orange' })]), HIT, hungry);
    const events = record(night);
    night.toggleShutter('left');
    night.toggleMonitor();
    night.step(1);
    expect(night.status).toBe('blackout');
    expect(events).toContainEqual({ kind: 'blackout' });
    expect(night.isClosed('left')).toBe(false);
    expect(night.monitorUp).toBe(false);
    expect(night.toggleShutter('left')).toBe(false);
    expect(night.toggleMonitor()).toBe(false);
    expect(night.bars()).toBe(0);

    // HIT = 0 → затемнение длится ровно blackoutMin = 5 с. Монстры в нём не ходят.
    night.step(4.9);
    expect(night.status).toBe('blackout');
    expect(night.pointIndex('red')).toBe(0);
    night.step(0.2);
    expect(night.status).toBe('caught');
    expect(events).toContainEqual({ kind: 'caught', monster: 'red' });
  });

  it('6 AM посреди затемнения спасает', () => {
    const night = new Night(def(), () => 0.5, { ...hungry, hourSeconds: 1 });
    night.step(1);
    expect(night.status).toBe('blackout');
    for (let i = 0; i < 5; i++) night.step(1);
    expect(night.status).toBe('won');
  });
});

describe('помехи на камере', () => {
  it('монстр вошёл в смотримую комнату', () => {
    const night = new Night(def(), HIT);
    night.toggleMonitor();
    night.selectCamera('2');
    night.step(5);
    expect(night.staticLeft).toBeCloseTo(1);
    night.step(0.5);
    expect(night.staticLeft).toBeCloseTo(0.5);
  });

  it('монстр вышел из смотримой комнаты', () => {
    const night = new Night(def(), HIT);
    night.toggleMonitor();
    night.step(5);
    expect(night.staticLeft).toBeCloseTo(1);
  });

  it('не задело смотримую комнату — помех нет', () => {
    const night = new Night(def(), HIT);
    night.toggleMonitor();
    night.selectCamera('3');
    night.step(5);
    expect(night.staticLeft).toBe(0);
  });

  it('монитор опущен — помех нет', () => {
    const night = new Night(def(), HIT);
    night.step(5);
    expect(night.staticLeft).toBe(0);
  });
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run src/core/night.test.ts`
Expected: FAIL — `Cannot find module './night'`.

- [ ] **Step 4: Реализовать ядро**

`src/core/night.ts`:

```ts
import { NIGHT } from '../config';
import type { NightDef, NightMonster, RoutePoint, ShutterSide } from './types';

export type LightSide = 'left' | 'right';
export type NightStatus = 'running' | 'blackout' | 'caught' | 'won';

export type NightEvent =
  | { kind: 'moved'; monster: string; from: RoutePoint; to: RoutePoint }
  | { kind: 'repelled'; monster: string; side: ShutterSide }
  | { kind: 'blackout' }
  | { kind: 'caught'; monster: string }
  | { kind: 'won' };

/** Числа, от которых зависит ход ночи. По умолчанию — `NIGHT`; тесты подставляют свои. */
export interface NightTuning {
  hourSeconds: number;
  hours: number;
  drainPerBar: number;
  opportunitySeconds: number;
  blackoutMin: number;
  blackoutMax: number;
  staticSeconds: number;
}

/**
 * Ночь целиком, без единого меша: часы, энергия, заслонки, свет, монитор и
 * монстры. Случайность подаётся снаружи, поэтому любой ход ночи воспроизводим
 * в тестах. Рендер и HUD только читают состояние и зовут `toggle*`.
 */
export class Night {
  time = 0;
  power = 100;
  status: NightStatus = 'running';
  monitorUp = false;
  /** Камера, выбранная на мониторе. Выбор переживает опускание монитора. */
  camera: string;

  private readonly closed = new Set<ShutterSide>();
  private readonly lit = new Set<LightSide>();
  private readonly index = new Map<string, number>();
  private readonly listeners: Array<(event: NightEvent) => void> = [];
  private sinceRoll = 0;
  private blackoutLeft = 0;
  private staticRemaining = 0;

  constructor(
    private readonly def: NightDef,
    private readonly rng: () => number,
    private readonly tuning: NightTuning = NIGHT,
  ) {
    const first = def.cameras[0];
    if (!first) throw new Error('Ночь без камер: валидатор должен был это поймать.');
    this.camera = first.id;
    for (const m of def.monsters) this.index.set(m.id, 0);
  }

  on(listener: (event: NightEvent) => void): void {
    this.listeners.push(listener);
  }

  /** 0 — это 12 AM, 6 — это 6 AM. */
  get hour(): number {
    return Math.min(this.tuning.hours, Math.floor(this.time / this.tuning.hourSeconds));
  }

  /** Сколько секунд ещё идут помехи на камере монитора. */
  get staticLeft(): number {
    return this.staticRemaining;
  }

  /** Полоски расхода. Одна горит всегда; после конца энергии не горит ничего. */
  bars(): number {
    if (this.status !== 'running') return 0;
    return 1 + this.closed.size + this.lit.size + (this.monitorUp ? 1 : 0);
  }

  isClosed(side: ShutterSide): boolean {
    return this.closed.has(side);
  }

  isLit(side: LightSide): boolean {
    return this.lit.has(side);
  }

  pointIndex(id: string): number {
    const i = this.index.get(id);
    if (i === undefined) throw new Error(`Монстра "${id}" нет.`);
    return i;
  }

  pointOf(id: string): RoutePoint {
    return this.monster(id).route[this.pointIndex(id)]!;
  }

  /** Стоит у своей заслонки и ждёт следующего броска. */
  atDoor(id: string): boolean {
    return this.pointIndex(id) === this.monster(id).route.length - 1;
  }

  /** false — нажатие отвергнуто: поднят монитор, нет энергии или ночь кончилась. */
  toggleShutter(side: ShutterSide): boolean {
    if (this.status !== 'running' || this.monitorUp) return false;
    if (!this.closed.delete(side)) this.closed.add(side);
    return true;
  }

  toggleLight(side: LightSide): boolean {
    if (this.status !== 'running' || this.monitorUp) return false;
    if (!this.lit.delete(side)) this.lit.add(side);
    return true;
  }

  toggleMonitor(): boolean {
    if (this.status !== 'running') return false;
    this.monitorUp = !this.monitorUp;
    // Свет в проёме, пока смотришь в планшет, — энергия, потраченная ни на что.
    if (this.monitorUp) this.lit.clear();
    return true;
  }

  selectCamera(id: string): boolean {
    if (!this.def.cameras.some((c) => c.id === id)) return false;
    this.camera = id;
    return true;
  }

  step(dt: number): void {
    if (this.status === 'caught' || this.status === 'won') return;
    this.time += dt;
    this.staticRemaining = Math.max(0, this.staticRemaining - dt);

    // Победа проверяется первой: 6 AM посреди затемнения спасает.
    if (this.time >= this.tuning.hours * this.tuning.hourSeconds) {
      this.status = 'won';
      this.emit({ kind: 'won' });
      return;
    }

    if (this.status === 'blackout') {
      this.blackoutLeft -= dt;
      if (this.blackoutLeft <= 0) this.catchBy(this.def.monsters[0]!.id);
      return;
    }

    this.power = Math.max(0, this.power - this.bars() * this.tuning.drainPerBar * dt);
    if (this.power <= 0) {
      this.startBlackout();
      return;
    }

    // `while`, а не `if`: кадр после возврата вкладки может принести больше
    // одного периода, и броски за него не должны пропадать.
    this.sinceRoll += dt;
    while (this.sinceRoll >= this.tuning.opportunitySeconds && this.status === 'running') {
      this.sinceRoll -= this.tuning.opportunitySeconds;
      this.roll();
    }
  }

  private monster(id: string): NightMonster {
    const m = this.def.monsters.find((x) => x.id === id);
    if (!m) throw new Error(`Монстра "${id}" нет.`);
    return m;
  }

  private emit(event: NightEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private startBlackout(): void {
    this.status = 'blackout';
    this.closed.clear();
    this.lit.clear();
    this.monitorUp = false;
    const { blackoutMin, blackoutMax } = this.tuning;
    this.blackoutLeft = blackoutMin + this.rng() * (blackoutMax - blackoutMin);
    this.emit({ kind: 'blackout' });
  }

  private roll(): void {
    for (const m of this.def.monsters) {
      if (this.rng() >= m.aggression / 20) continue;
      const i = this.pointIndex(m.id);
      const from = m.route[i]!;
      if (i < m.route.length - 1) {
        this.index.set(m.id, i + 1);
        this.moved(m.id, from, m.route[i + 1]!);
        continue;
      }
      // Стоял у заслонки. Закрыта в этот момент — на старт; открыта — вошёл.
      if (!this.closed.has(m.door)) {
        this.catchBy(m.id);
        return;
      }
      this.index.set(m.id, 0);
      this.emit({ kind: 'repelled', monster: m.id, side: m.door });
      this.moved(m.id, from, m.route[0]!);
    }
  }

  private moved(id: string, from: RoutePoint, to: RoutePoint): void {
    if (this.monitorUp) {
      const room = this.def.cameras.find((c) => c.id === this.camera)?.room;
      if (from.room === room || to.room === room) this.staticRemaining = this.tuning.staticSeconds;
    }
    this.emit({ kind: 'moved', monster: id, from, to });
  }

  private catchBy(id: string): void {
    this.status = 'caught';
    this.emit({ kind: 'caught', monster: id });
  }
}
```

- [ ] **Step 5: Прогнать тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/core/night.ts src/core/night.test.ts
git commit -m "Ядро ночи: часы, энергия, заслонки, прыжки монстров"
```

---

### Task 3: Уровень 4 по рисунку, тесты данных и сквозная ночь

**Files:**
- Create: `src/levels/level_04.json`
- Modify: `src/levels/index.ts`
- Test: `src/levels/level_04.test.ts`
- Test: `src/core/walkthrough-04.test.ts`

**Interfaces:**
- Consumes: `validateLevel` с блоком `night` (задача 1), `Night` (задача 2).
- Produces: `loadLevel('level_04')` возвращает валидный уровень с `night`; `nextLevelId('level_03') === 'level_04'`.

Расшифровка рисунка — спека §3. Оси: x вправо, z вниз по листу; игрок в офисе с yaw 0 смотрит на север (−z), в сторону зала: слева `west_room`, прямо вентиляция, справа `east_room`. Квадратики камер на карте монитора рисуются посередине между `at` и `look` (задача 6), поэтому точки взгляда подобраны так, чтобы квадратики не слипались: при карте 320×230 ближайшая пара (5 и 8) разнесена на 46 px при стороне квадратика 44. Меняя `look`, проверять `map.test.ts`.

- [ ] **Step 1: Написать падающие тесты данных**

`src/levels/level_04.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import rawLevel from './level_04.json';
import rawItems from './items.json';
import { validateLevel } from '../core/validate';
import { nextLevelId } from './index';
import type { ItemDef } from '../core/types';

const defs = rawItems as unknown as Record<string, ItemDef>;

function load() {
  const result = validateLevel(rawLevel, defs);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const night = result.level.night;
  if (!night) throw new Error('У уровня 4 нет блока night.');
  return { level: result.level, night };
}

describe('level_04', () => {
  it('проходит валидацию', () => {
    const result = validateLevel(rawLevel, defs);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('идёт после третьего уровня', () => {
    expect(nextLevelId('level_03')).toBe('level_04');
  });

  it('шесть комнат, у офиса ровно три двери — и все три заслонки', () => {
    const { level, night } = load();
    expect(level.rooms).toHaveLength(6);
    const officeDoors = level.doors.filter((d) => d.between.includes(night.office)).map((d) => d.id).sort();
    expect(officeDoors).toEqual(Object.values(night.shutters).sort());
  });

  it('девять камер с номерами 1–9, как на рисунке', () => {
    const { night } = load();
    expect(night.cameras.map((c) => c.id).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('маршруты по рисунку: длина, старт и заслонка', () => {
    const { night } = load();
    const byId = new Map(night.monsters.map((m) => [m.id, m]));
    expect([...byId.keys()]).toEqual(['red', 'orange', 'purple', 'grey']);
    expect(byId.get('red')!.route).toHaveLength(5);
    expect(byId.get('orange')!.route).toHaveLength(6);
    expect(byId.get('purple')!.route).toHaveLength(6);
    expect(byId.get('grey')!.route).toHaveLength(4);
    expect(byId.get('red')!.door).toBe('right');
    expect(byId.get('orange')!.door).toBe('right');
    expect(byId.get('purple')!.door).toBe('left');
    expect(byId.get('grey')!.door).toBe('vent');
    expect(byId.get('grey')!.route[0]!.room).toBe('backroom');
  });

  it('красный, оранжевый и фиолетовый стартуют на помосте', () => {
    const { night } = load();
    const [x, z, w, d] = night.stage!;
    for (const id of ['red', 'orange', 'purple']) {
      const [px, pz] = night.monsters.find((m) => m.id === id)!.route[0]!.at;
      expect(px >= x && px <= x + w && pz >= z && pz <= z + d, id).toBe(true);
    }
  });

  // Первый в списке приходит при нуле энергии (спека §4) — это красный.
  it('первым в списке стоит красный', () => {
    expect(load().night.monsters[0]!.id).toBe('red');
  });

  it('красный и оранжевый ждут у правой двери не в одной точке', () => {
    const { night } = load();
    const last = (id: string) => {
      const route = night.monsters.find((m) => m.id === id)!.route;
      return route[route.length - 1]!.at;
    };
    const [ax, az] = last('red');
    const [bx, bz] = last('orange');
    expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThanOrEqual(0.6);
  });
});
```

`src/core/walkthrough-04.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { Night } from './night';
import { SHUTTER_SIDES } from './types';

/** Детерминированный генератор: одно и то же зерно — одна и та же ночь. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 0.05;

/**
 * Ночь целиком теми же вызовами, что делает цикл. «Аккуратный» игрок знает,
 * кто стоит у какой двери, и держит закрытой ровно ту заслонку, у которой
 * кто-то ждёт, — это верхняя граница игры. Если он не доживает до 6 AM,
 * ночь при текущих числах `NIGHT` непроходима в принципе.
 */
function play(seed: number, careful: boolean): Night {
  const loaded = loadLevel('level_04');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const def = loaded.level.night!;
  const night = new Night(def, mulberry32(seed));
  for (let i = 0; i < 8000 && (night.status === 'running' || night.status === 'blackout'); i++) {
    if (careful) {
      for (const side of SHUTTER_SIDES) {
        const threat = def.monsters.some((m) => m.door === side && night.atDoor(m.id));
        if (threat !== night.isClosed(side)) night.toggleShutter(side);
      }
    }
    night.step(DT);
  }
  return night;
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('ночь уровня 4', () => {
  it.each(SEEDS)('бездельника ловят (зерно %i)', (seed) => {
    expect(play(seed, false).status).toBe('caught');
  });

  it.each(SEEDS)('аккуратный доживает до 6 AM с энергией (зерно %i)', (seed) => {
    const night = play(seed, true);
    expect(night.status).toBe('won');
    expect(night.power).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/levels/level_04.test.ts src/core/walkthrough-04.test.ts`
Expected: FAIL — `level_04.json` не найден.

- [ ] **Step 3: Уровень**

`src/levels/level_04.json`:

```json
{
  "id": "level_04",
  "spawn": { "room": "office", "x": 10.5, "z": 16.5, "yaw": 0 },

  "rooms": [
    { "id": "hall",      "rect": [4, 0, 16, 10], "color": "#5f5a66", "light": 0.45, "style": "kitchen" },
    { "id": "backroom",  "rect": [0, 1, 4, 4],   "color": "#4f4a55", "light": 0.3,  "style": "kitchen" },
    { "id": "west_room", "rect": [5, 10, 3, 8],  "color": "#5a5560", "light": 0.35, "style": "kitchen" },
    { "id": "vent",      "rect": [10, 10, 1, 4], "color": "#44474d", "light": 0.15 },
    { "id": "east_room", "rect": [13, 10, 3, 8], "color": "#5a5560", "light": 0.35, "style": "kitchen" },
    { "id": "office",    "rect": [8, 14, 5, 4],  "color": "#655f52", "light": 0.6,  "style": "kitchen" }
  ],

  "doors": [
    { "id": "d_backroom_hall", "between": ["backroom", "hall"],   "at": [4, 3] },
    { "id": "d_hall_west",     "between": ["hall", "west_room"],  "at": [6.5, 10] },
    { "id": "d_hall_vent",     "between": ["hall", "vent"],       "at": [10.5, 10] },
    { "id": "d_hall_east",     "between": ["hall", "east_room"],  "at": [14.5, 10] },
    { "id": "d_office_w",      "between": ["west_room", "office"], "at": [8, 16] },
    { "id": "d_office_vent",   "between": ["vent", "office"],     "at": [10.5, 14] },
    { "id": "d_office_e",      "between": ["office", "east_room"], "at": [13, 16] }
  ],

  "night": {
    "office": "office",
    "shutters": { "left": "d_office_w", "vent": "d_office_vent", "right": "d_office_e" },
    "stage": [8, 0, 8, 3],

    "cameras": [
      { "id": "1", "room": "hall",      "at": [12, 8],      "look": [12, 1.5] },
      { "id": "2", "room": "hall",      "at": [19.4, 9.4],  "look": [13.5, 3] },
      { "id": "3", "room": "hall",      "at": [4.6, 9.4],   "look": [8.5, 3.5] },
      { "id": "4", "room": "backroom",  "at": [3.6, 4.6],   "look": [1, 2] },
      { "id": "5", "room": "vent",      "at": [10.5, 10.3], "look": [10.5, 14] },
      { "id": "6", "room": "east_room", "at": [15.6, 10.4], "look": [14, 13.5] },
      { "id": "7", "room": "east_room", "at": [15.6, 17.6], "look": [13.8, 15] },
      { "id": "8", "room": "west_room", "at": [5.4, 17.6],  "look": [7.5, 14.5] },
      { "id": "9", "room": "west_room", "at": [5.4, 10.4],  "look": [7, 13] }
    ],

    "monsters": [
      { "id": "red", "color": "#c0302a", "aggression": 6, "door": "right",
        "route": [
          { "room": "hall",      "at": [10, 1.5] },
          { "room": "hall",      "at": [11, 5.5] },
          { "room": "east_room", "at": [14.5, 11.5] },
          { "room": "east_room", "at": [15.2, 16.8] },
          { "room": "east_room", "at": [13.8, 16.35] }
        ] },
      { "id": "orange", "color": "#d98a2b", "aggression": 6, "door": "right",
        "route": [
          { "room": "hall",      "at": [14, 1.5] },
          { "room": "hall",      "at": [13.5, 5.5] },
          { "room": "hall",      "at": [14.5, 9] },
          { "room": "east_room", "at": [14.5, 13.5] },
          { "room": "east_room", "at": [14.2, 17.2] },
          { "room": "east_room", "at": [13.8, 15.65] }
        ] },
      { "id": "purple", "color": "#7a3fa8", "aggression": 7, "door": "left",
        "route": [
          { "room": "hall",      "at": [12, 1.5] },
          { "room": "hall",      "at": [12.5, 6] },
          { "room": "hall",      "at": [7, 6] },
          { "room": "west_room", "at": [6.5, 11.5] },
          { "room": "west_room", "at": [6, 15.5] },
          { "room": "west_room", "at": [7.2, 16] }
        ] },
      { "id": "grey", "color": "#9a9a9e", "aggression": 5, "door": "vent",
        "route": [
          { "room": "backroom",  "at": [2, 3] },
          { "room": "hall",      "at": [6, 4] },
          { "room": "vent",      "at": [10.5, 11.5] },
          { "room": "vent",      "at": [10.5, 13.3] }
        ] }
    ]
  }
}
```

- [ ] **Step 4: Реестр**

В `src/levels/index.ts` после `import rawLevel03 ...`:

```ts
import rawLevel04 from './level_04.json';
```

и в `LEVELS` после строки `level_03`:

```ts
  { id: 'level_04', raw: rawLevel04 },
```

- [ ] **Step 5: Прогнать тесты**

Run: `npm test`
Expected: PASS. Если валидатор отверг уровень, его сообщения — готовый диагноз: поправить координаты в JSON, а не правило. Если «аккуратный» игрок не доживает хотя бы на одном зерне — СТОП, не подгонять числа молча, доложить: это вопрос баланса к пользователю (при числах спеки расчёт даёт 34–42% энергии в 6 AM на всех десяти зёрнах).

- [ ] **Step 6: Commit**

```bash
git add src/levels/level_04.json src/levels/index.ts src/levels/level_04.test.ts src/core/walkthrough-04.test.ts
git commit -m "Уровень 4: пиццерия по рисунку, сквозная ночь"
```

---

### Task 4: Развилка режимов и ночная сцена

**Files:**
- Create: `src/context.ts`
- Create: `src/explore.ts`
- Modify: `src/main.ts` (переписывается целиком, см. ниже)
- Modify: `src/render/scene.ts` (сигнатура `buildScene`, свет, створки)
- Modify: `src/render/antagonist.ts` (параметр цвета)
- Create: `src/night/pose.ts`
- Test: `src/night/pose.test.ts`
- Create: `src/night/scene.ts`
- Create: `src/night/run.ts`

**Interfaces:**
- Consumes: `Night` (задача 2), `level_04` (задача 3), `NIGHT`.
- Produces:
  - `export interface RunContext { level: Level; canvas: HTMLCanvasElement; renderer: THREE.WebGLRenderer; debug: DebugFlags; isStopped(): boolean; stopLoop(): void }` в `src/context.ts`
  - `export function runExplore(ctx: RunContext): void` в `src/explore.ts`
  - `export function runNight(ctx: RunContext, def: NightDef): void` в `src/night/run.ts`
  - `buildScene(level, world, options?: SceneOptions)`, `export interface SceneOptions { doorLeaves?: boolean; ambient?: number }`
  - `createAntagonistMesh(look?: { color: string; emissive: string })`
  - `pose.ts`: `facingToward(from, to): number`, `onStage(def, at): boolean`, `monsterPose(def, shutterAt, night, id): MonsterPose`, `visibleFromOffice(def, night, id): boolean`, `interface MonsterPose { x; z; y; facing }`
  - `scene.ts`: `shutterPoints(level, def): Record<ShutterSide, readonly [number, number]>`, `buildShutters(level, def): Shutters`, `buildDoorLights(level, def): DoorLights`, `buildProps(level, def): THREE.Group`, `createMonsterMesh(color): { group; update(x, z, facing) }`, `buildMonsters(def, shutterAt): MonsterMeshes`

- [ ] **Step 1: `RunContext`**

`src/context.ts`:

```ts
import type * as THREE from 'three';
import type { Level } from './core/types';
import type { DebugFlags } from './debug';

/**
 * То, что общее у обоих режимов и создаётся в `main.ts` до развилки: уровень,
 * холст, рендерер и выключатель цикла, на который завязаны ловушки ошибок.
 */
export interface RunContext {
  level: Level;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  debug: DebugFlags;
  /** Цикл остановлен — экраном ошибки или финалом. Проверяется первым делом в кадре. */
  isStopped(): boolean;
  stopLoop(): void;
}
```

- [ ] **Step 2: Опции `buildScene`**

В `src/render/scene.ts` перед `export function buildScene`:

```ts
export interface SceneOptions {
  /** false — проёмы без створок. Ночью двери никто не открывает, а закрытая створка загородила бы камеры. */
  doorLeaves?: boolean;
  /** Сила общего полусферического света. По умолчанию 2.6 — уровни исследования. */
  ambient?: number;
}

const NO_DOORS: Doors = { group: new THREE.Group(), targets: [], update() {} };
```

Сигнатура и две строки внутри:

```ts
export function buildScene(level: Level, world: World, options: SceneOptions = {}): SceneBuild {
```

```ts
  scene.add(new THREE.HemisphereLight(0xdfe4ff, 0xb0b0b0, options.ambient ?? 2.6));
```

```ts
  const doors = options.doorLeaves === false ? NO_DOORS : buildDoors(level, world);
```

- [ ] **Step 3: Цвет меша антагониста**

В `src/render/antagonist.ts`:

```ts
export function createAntagonistMesh(
  look: { color: string; emissive: string } = { color: '#2b2f36', emissive: '#171a1f' },
): {
```

и материал:

```ts
  const material = new THREE.MeshStandardMaterial({
    color: look.color, emissive: look.emissive, emissiveIntensity: 0.6,
  });
```

Вызов без аргументов в `explore.ts` не меняется.

- [ ] **Step 4: Падающие тесты позы**

`src/night/pose.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NIGHT } from '../config';
import { Night } from '../core/night';
import type { NightDef } from '../core/types';
import { facingToward, monsterPose, onStage, visibleFromOffice } from './pose';

const def: NightDef = {
  office: 'office',
  shutters: { left: 'dl', vent: 'dv', right: 'dr' },
  stage: [0, 0, 4, 2],
  cameras: [{ id: '1', room: 'hall', at: [1, 1], look: [2, 2] }],
  monsters: [
    { id: 'red', color: '#c0302a', aggression: 20, door: 'right',
      route: [{ room: 'hall', at: [1, 1] }, { room: 'east', at: [5, 5] }] },
    { id: 'grey', color: '#9a9a9e', aggression: 20, door: 'vent',
      route: [{ room: 'hall', at: [3, 3] }, { room: 'vent', at: [6, 6] }] },
  ],
};
const shutterAt = { left: [0, 8], vent: [6, 8], right: [5, 8] } as const;

describe('facingToward', () => {
  // Соглашение yaw: взгляд в (-sin f, -cos f).
  it('на −z — ноль', () => expect(facingToward([0, 0], [0, -1])).toBeCloseTo(0));
  it('на −x — плюс π/2', () => expect(facingToward([0, 0], [-1, 0])).toBeCloseTo(Math.PI / 2));
  it('на +x — минус π/2', () => expect(facingToward([0, 0], [1, 0])).toBeCloseTo(-Math.PI / 2));
});

describe('onStage', () => {
  it('точка внутри помоста', () => expect(onStage(def, [1, 1])).toBe(true));
  it('точка вне помоста', () => expect(onStage(def, [5, 5])).toBe(false));
  it('уровень без помоста', () => expect(onStage({ ...def, stage: undefined }, [1, 1])).toBe(false));
});

describe('monsterPose', () => {
  it('на сцене стоит на помосте и смотрит на следующую точку', () => {
    const night = new Night(def, () => 0.999);
    const pose = monsterPose(def, shutterAt, night, 'red');
    expect(pose.y).toBe(NIGHT.stageHeight);
    expect(pose.facing).toBeCloseTo(facingToward([1, 1], [5, 5]));
  });

  it('у заслонки стоит на полу и смотрит в проём', () => {
    const night = new Night(def, () => 0);
    night.step(5);
    const pose = monsterPose(def, shutterAt, night, 'red');
    expect(pose.y).toBe(0);
    expect(pose.facing).toBeCloseTo(facingToward([5, 5], [5, 8]));
  });
});

describe('visibleFromOffice', () => {
  it('в пути виден всегда', () => {
    expect(visibleFromOffice(def, new Night(def, () => 0.999), 'red')).toBe(true);
  });

  it('у двери — только при свете с её стороны', () => {
    const night = new Night(def, () => 0);
    night.step(5);
    expect(visibleFromOffice(def, night, 'red')).toBe(false);
    night.toggleLight('left');
    expect(visibleFromOffice(def, night, 'red')).toBe(false);
    night.toggleLight('right');
    expect(visibleFromOffice(def, night, 'red')).toBe(true);
  });

  it('у вентиляции не виден никогда — света там нет', () => {
    const night = new Night(def, () => 0);
    night.step(5);
    night.toggleLight('left');
    night.toggleLight('right');
    expect(visibleFromOffice(def, night, 'grey')).toBe(false);
  });
});
```

Run: `npx vitest run src/night/pose.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 5: `src/night/pose.ts`**

```ts
import { NIGHT } from '../config';
import type { Night } from '../core/night';
import type { NightDef, NightMonster, ShutterSide } from '../core/types';

export interface MonsterPose {
  x: number;
  z: number;
  /** Высота ног: на помосте — его высота. */
  y: number;
  facing: number;
}

/** Угол yaw, при котором взгляд (-sin f, -cos f) направлен из `from` в `to`. */
export function facingToward(from: readonly [number, number], to: readonly [number, number]): number {
  return Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
}

export function onStage(def: NightDef, at: readonly [number, number]): boolean {
  if (!def.stage) return false;
  const [x, z, w, d] = def.stage;
  return at[0] >= x && at[0] <= x + w && at[1] >= z && at[1] <= z + d;
}

function monster(def: NightDef, id: string): NightMonster {
  const m = def.monsters.find((x) => x.id === id);
  if (!m) throw new Error(`Монстра "${id}" нет.`);
  return m;
}

/** Где стоит и куда смотрит: на следующую точку маршрута, а у заслонки — в проём. */
export function monsterPose(
  def: NightDef,
  shutterAt: Record<ShutterSide, readonly [number, number]>,
  night: Night,
  id: string,
): MonsterPose {
  const m = monster(def, id);
  const i = night.pointIndex(id);
  const here = m.route[i]!;
  const target = i === m.route.length - 1 ? shutterAt[m.door] : m.route[i + 1]!.at;
  return {
    x: here.at[0],
    z: here.at[1],
    y: onStage(def, here.at) ? NIGHT.stageHeight : 0,
    facing: facingToward(here.at, target),
  };
}

/**
 * Правило спеки §4: стоящего в проёме видно из офиса только при свете с его
 * стороны. У вентиляции света нет — серого там видно только на камере 5.
 * Решается видимостью меша, а не освещением: лампа комнаты за дверью светит
 * и в проём, и «не видно» тогда зависело бы от яркости экрана телефона.
 */
export function visibleFromOffice(def: NightDef, night: Night, id: string): boolean {
  if (!night.atDoor(id)) return true;
  const door = monster(def, id).door;
  return door !== 'vent' && night.isLit(door);
}
```

Run: `npx vitest run src/night/pose.test.ts`
Expected: PASS.

- [ ] **Step 6: `src/night/scene.ts`**

```ts
import * as THREE from 'three';
import { DOOR, NIGHT, ROOM } from '../config';
import type { Night } from '../core/night';
import type { Level, NightDef, RoomDef, ShutterSide } from '../core/types';
import { SHUTTER_SIDES } from '../core/types';
import { doorOnVerticalWall, roomBounds } from '../core/validate';
import { createAntagonistMesh } from '../render/antagonist';
import { monsterPose, visibleFromOffice } from './pose';

function officeOf(level: Level, def: NightDef): RoomDef {
  const office = level.rooms.find((r) => r.id === def.office);
  if (!office) throw new Error(`Офиса "${def.office}" нет.`);
  return office;
}

function shutterDoor(level: Level, def: NightDef, side: ShutterSide) {
  const door = level.doors.find((d) => d.id === def.shutters[side]);
  if (!door) throw new Error(`Двери заслонки "${side}" нет.`);
  return door;
}

export function shutterPoints(level: Level, def: NightDef): Record<ShutterSide, readonly [number, number]> {
  return {
    left: shutterDoor(level, def, 'left').at,
    vent: shutterDoor(level, def, 'vent').at,
    right: shutterDoor(level, def, 'right').at,
  };
}

const SHUTTER_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 0.6, metalness: 0.5 });
const SHUTTER_GEOMETRY = new THREE.BoxGeometry(DOOR.width + 0.1, DOOR.height, 0.08);

export interface Shutters {
  group: THREE.Group;
  update(dt: number, closed: (side: ShutterSide) => boolean): void;
}

/**
 * Шторка стоит ровно на линии стыка комнат. Открытая уходит вверх на свою
 * высоту — в толщу перемычки и выше потолка, откуда её не видно ни из офиса,
 * ни с камер: стены строятся внутрь комнат, и на стыке их две.
 */
export function buildShutters(level: Level, def: NightDef): Shutters {
  const group = new THREE.Group();
  const office = officeOf(level, def);
  const panels = new Map<ShutterSide, { mesh: THREE.Mesh; t: number }>();
  for (const side of SHUTTER_SIDES) {
    const door = shutterDoor(level, def, side);
    const mesh = new THREE.Mesh(SHUTTER_GEOMETRY, SHUTTER_MATERIAL);
    mesh.position.set(door.at[0], DOOR.height * 1.5, door.at[1]);
    if (doorOnVerticalWall(door, office)) mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
    panels.set(side, { mesh, t: 0 });
  }
  return {
    group,
    update(dt, closed) {
      const step = dt / NIGHT.shutterSeconds;
      for (const [side, panel] of panels) {
        panel.t = closed(side) ? Math.min(1, panel.t + step) : Math.max(0, panel.t - step);
        panel.mesh.position.y = DOOR.height * (1.5 - panel.t);
      }
    },
  };
}

export interface DoorLights {
  group: THREE.Group;
  update(lit: (side: 'left' | 'right') => boolean): void;
}

/** Лампа — на метр за проёмом, в соседней комнате: светит на того, кто стоит в проёме. */
export function buildDoorLights(level: Level, def: NightDef): DoorLights {
  const group = new THREE.Group();
  const office = officeOf(level, def);
  const b = roomBounds(office);
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const lamps = new Map<'left' | 'right', THREE.PointLight>();
  for (const side of ['left', 'right'] as const) {
    const door = shutterDoor(level, def, side);
    const vertical = doorOnVerticalWall(door, office);
    const lamp = new THREE.PointLight(0xfff0cc, 0, 4, 2);
    lamp.position.set(
      door.at[0] + (vertical ? Math.sign(door.at[0] - cx) : 0),
      2.0,
      door.at[1] + (vertical ? 0 : Math.sign(door.at[1] - cz)),
    );
    group.add(lamp);
    lamps.set(side, lamp);
  }
  return {
    group,
    // Меняется только яркость, число источников постоянно — шейдеры не пересобираются.
    update(lit) {
      for (const [side, lamp] of lamps) lamp.intensity = lit(side) ? 6 : 0;
    },
  };
}

/** Помост сцены и стол в офисе, правее вентиляции. */
export function buildProps(level: Level, def: NightDef): THREE.Group {
  const group = new THREE.Group();
  if (def.stage) {
    const [x, z, w, d] = def.stage;
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(w, NIGHT.stageHeight, d),
      new THREE.MeshStandardMaterial({ color: 0x4a2f2a, roughness: 0.8 }),
    );
    stage.position.set(x + w / 2, NIGHT.stageHeight / 2, z + d / 2);
    group.add(stage);
  }
  const b = roomBounds(officeOf(level, def));
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.75, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.7 }),
  );
  desk.position.set((b.x0 + b.x1) / 2 + 1.2, 0.375, b.z0 + ROOM.wallThickness + 0.35);
  group.add(desk);
  return group;
}

const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
const EYE_GEOMETRY = new THREE.SphereGeometry(0.035, 10, 8);

/** Меш антагониста своего цвета плюс два светящихся глаза — чтобы в скримере было лицо. */
export function createMonsterMesh(color: string): ReturnType<typeof createAntagonistMesh> {
  const emissive = `#${new THREE.Color(color).multiplyScalar(0.35).getHexString()}`;
  const mesh = createAntagonistMesh({ color, emissive });
  for (const sx of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(EYE_GEOMETRY, EYE_MATERIAL);
    // Голова — куб 0.32 с центром на 1.5 м; «вперёд» у меша — −Z.
    eye.position.set(sx, 1.53, -0.165);
    mesh.group.add(eye);
  }
  return mesh;
}

export interface MonsterMeshes {
  group: THREE.Group;
  /** `office` — действует правило видимости в проёме; `feed` — камера видит всех. */
  update(night: Night, view: 'office' | 'feed'): void;
}

export function buildMonsters(
  def: NightDef,
  shutterAt: Record<ShutterSide, readonly [number, number]>,
): MonsterMeshes {
  const group = new THREE.Group();
  const meshes = def.monsters.map((m) => {
    const mesh = createMonsterMesh(m.color);
    group.add(mesh.group);
    return { id: m.id, mesh };
  });
  return {
    group,
    update(night, view) {
      for (const { id, mesh } of meshes) {
        const pose = monsterPose(def, shutterAt, night, id);
        mesh.update(pose.x, pose.z, pose.facing);
        mesh.group.position.y = pose.y;
        mesh.group.visible = view === 'feed' || visibleFromOffice(def, night, id);
      }
    },
  };
}
```

- [ ] **Step 7: `src/night/run.ts` — сцена и цикл без управления**

```ts
import * as THREE from 'three';
import { MAX_DELTA_SECONDS, NIGHT, PLAYER } from '../config';
import { Night } from '../core/night';
import type { NightDef } from '../core/types';
import { World } from '../core/world';
import type { RunContext } from '../context';
import { buildScene } from '../render/scene';
import { showFatal } from '../ui/fatal';
import { buildDoorLights, buildMonsters, buildProps, buildShutters, shutterPoints } from './scene';

/** Лёгкий наклон взгляда вниз: из-за стола видно пол в проёмах. */
const OFFICE_PITCH = -0.05;

export function runNight(ctx: RunContext, def: NightDef): void {
  const { level, renderer } = ctx;

  // `World` нужен только построителю сцены: ночью двери никто не открывает.
  const world = new World(level);
  const { scene } = buildScene(level, world, { doorLeaves: false, ambient: NIGHT.ambient });

  const night = new Night(def, Math.random);
  const shutterAt = shutterPoints(level, def);
  const shutters = buildShutters(level, def);
  const doorLights = buildDoorLights(level, def);
  const monsters = buildMonsters(def, shutterAt);
  scene.add(shutters.group, doorLights.group, monsters.group, buildProps(level, def));

  const officeCamera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
  officeCamera.rotation.order = 'YXZ';
  officeCamera.position.set(level.spawn.x, PLAYER.eyeHeight, level.spawn.z);
  let yaw = level.spawn.yaw;

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    officeCamera.aspect = width / height;
    officeCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let previous = performance.now();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) previous = performance.now();
  });

  renderer.setAnimationLoop((now) => {
    if (ctx.isStopped()) return;
    try {
      const dt = Math.min((now - previous) / 1000, MAX_DELTA_SECONDS);
      previous = now;

      night.step(dt);

      shutters.update(dt, (side) => night.isClosed(side));
      doorLights.update((side) => night.isLit(side));
      monsters.update(night, 'office');
      officeCamera.rotation.set(OFFICE_PITCH, yaw, 0);
      renderer.render(scene, officeCamera);
    } catch (error) {
      // Без остановки цикла браузер получит шестьдесят ошибок в секунду.
      renderer.setAnimationLoop(null);
      showFatal('Ошибка в игровом цикле', [
        error instanceof Error ? error.message : String(error),
        error instanceof Error && error.stack ? error.stack : '',
      ]);
    }
  });
}
```

`yaw` пока не меняется — поворот головы появится в задаче 5. `main.ts` этот файл ещё не вызывает: развилка — в шаге 9.

- [ ] **Step 8: Перенести цикл ходьбы в `src/explore.ts`**

Чистый перенос без изменений поведения. `src/explore.ts` собирается так:

1. Импорты — все импорты старого `main.ts` (строки 1–22), **кроме** `loadLevel`, `hasWebGl`, `applyDebug`, `parseDebug`. Из `./levels` остаётся только `nextLevelId`, из `./ui/fatal` — только `showFatal`. Плюс `import type { RunContext } from './context';`.
2. Тело:

```ts
export function runExplore(ctx: RunContext): void {
  const { level, canvas, renderer, debug } = ctx;

  const world = new World(level);
  const allColliders = buildColliders(level);

  // ↓ сюда — строки 97–398 старого main.ts (от `const camera = new THREE.PerspectiveCamera(70, ...`
  //   до конца файла), с отступом на один уровень и ровно двумя заменами:
  //   `if (stopped) return;`  →  `if (ctx.isStopped()) return;`
  //   `stopLoop();` внутри `endGame`  →  `ctx.stopLoop();`
}
```

Комментарии в перенесённом коде сохраняются дословно. Других правок в этом шаге нет.

- [ ] **Step 9: Переписать `src/main.ts`**

Новый `src/main.ts` — строки 24–63 и 68–95 старого файла без изменений, плюс развилка:

```ts
import * as THREE from 'three';
import { loadLevel } from './levels';
import { hasWebGl, showFatal } from './ui/fatal';
import { applyDebug, parseDebug } from './debug';
import { runExplore } from './explore';
import { runNight } from './night/run';

// ↓ строки 24–63 старого main.ts без изменений: `let stopLoop`, обе ловушки ошибок,
//   поиск холста, проверка WebGL, загрузка уровня, `debug` и `level`.

// ↓ строки 68–95 старого main.ts без изменений: рендерер, `let stopped`, `stopLoop = ...`,
//   обработчик `webglcontextlost`.

const ctx = {
  level, canvas, renderer, debug,
  isStopped: () => stopped,
  stopLoop: () => stopLoop(),
};

// Ночь — другой жанр в той же игре: ни ходьбы, ни коллизий, ни ключей. Два цикла
// в одном файле срослись бы, и каждая правка ходьбы должна была бы помнить о ночи.
if (level.night) runNight(ctx, level.night);
else runExplore(ctx);
```

Строки 65–66 старого файла (`world`, `allColliders`) уже переехали в `runExplore`.

- [ ] **Step 10: Убедиться, что ходьба не сломана**

Run: `npm test`
Expected: PASS.

Run: `npm run dev`, открыть `http://localhost:5173/bandy/#level_01`, начать, пройти пару шагов, открыть рюкзак, открыть `#level_03` — антагонист ходит, шаги слышны.
Expected: всё как до переноса.

- [ ] **Step 11: Прогнать тесты и сборку**

Run: `npm test && npm run build`
Expected: PASS, сборка без ошибок.

- [ ] **Step 12: Проверка глазами**

Run: `npm run dev`, открыть `http://localhost:5173/bandy/#level_04`.
Expected:
- Консоль без ошибок.
- Из офиса прямо виден проём вентиляции, правее — стол, пол в чёрно-белую клетку.
- Проёмы — пустые, без створок; открытые шторки не торчат ни в проёмах, ни под потолком.
- Уровни `#level_01` и `#level_03` запускаются и играются как раньше.

Сообщить пользователю, что видно, и ждать подтверждения — поворот головы ещё не работает, дальше задача 5.

- [ ] **Step 13: Commit**

```bash
git add src/context.ts src/explore.ts src/main.ts src/render/scene.ts src/render/antagonist.ts src/night/
git commit -m "Ночь: развилка режимов в main.ts и сцена офиса"
```

---

### Task 5: Управление офисом

**Files:**
- Create: `src/night/input.ts`
- Test: `src/night/input.test.ts`
- Create: `src/night/hud.ts`
- Test: `src/night/hud.test.ts`
- Create: `src/night/start.ts`
- Modify: `src/night/run.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: `Night`, `NIGHT`, `LOOK`, `isCoarsePointer` из `src/input/index.ts`.
- Produces:
  - `input.ts`: `type NightAction = 'doorLeft' | 'lightLeft' | 'vent' | 'lightRight' | 'doorRight' | 'monitor'`, `keyAction(code): NightAction | null`, `edgePan(fraction): number`, `clampYaw(yaw, center): number`, `nightTicks(startVisible, portraitTouch): boolean`, `createNightInput(canvas): NightInput` с `takeYaw(dt): number`, `onAction(handler)`.
  - `hud.ts`: `clockLabel(hour): string`, `createNightHud(act): NightHud` с `show()`, `hide()`, `update(night)`.
  - `start.ts`: `createNightStart(coarse, onStart): NightStart` с `isVisible()`.

- [ ] **Step 1: Падающие тесты чистых функций**

`src/night/input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NIGHT } from '../config';
import { clampYaw, edgePan, keyAction, nightTicks } from './input';

describe('keyAction', () => {
  it('физические клавиши', () => {
    expect(keyAction('KeyQ')).toBe('doorLeft');
    expect(keyAction('KeyA')).toBe('lightLeft');
    expect(keyAction('KeyW')).toBe('vent');
    expect(keyAction('KeyD')).toBe('lightRight');
    expect(keyAction('KeyE')).toBe('doorRight');
    expect(keyAction('Space')).toBe('monitor');
  });
  it('чужие клавиши ничего не делают', () => {
    expect(keyAction('KeyS')).toBeNull();
    expect(keyAction('Escape')).toBeNull();
  });
});

describe('edgePan', () => {
  it('в середине экрана голова не крутится', () => {
    expect(edgePan(0.5)).toBe(0);
    expect(edgePan(0.2)).toBe(0);
    expect(edgePan(0.8)).toBe(0);
  });
  it('у левого края — влево, у правого — вправо, сильнее к краю', () => {
    expect(edgePan(0)).toBe(-1);
    expect(edgePan(1)).toBe(1);
    expect(edgePan(0.075)).toBeCloseTo(-0.5);
    expect(edgePan(0.925)).toBeCloseTo(0.5);
  });
});

describe('clampYaw', () => {
  it('не дальше ±70° от центра', () => {
    expect(clampYaw(5, 0)).toBeCloseTo(NIGHT.lookLimit);
    expect(clampYaw(-5, 0)).toBeCloseTo(-NIGHT.lookLimit);
    expect(clampYaw(0.3, 0)).toBeCloseTo(0.3);
  });
});

// Review Focus 1: телефон повернули в портрет — часы стоят.
describe('nightTicks', () => {
  it('часы идут только после старта и не в портрете на телефоне', () => {
    expect(nightTicks(false, false)).toBe(true);
    expect(nightTicks(true, false)).toBe(false);
    expect(nightTicks(false, true)).toBe(false);
  });
});
```

`src/night/hud.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clockLabel } from './hud';

describe('clockLabel', () => {
  it('полночь — 12 AM, дальше по часам', () => {
    expect(clockLabel(0)).toBe('12 AM');
    expect(clockLabel(1)).toBe('1 AM');
    expect(clockLabel(6)).toBe('6 AM');
  });
});
```

Run: `npx vitest run src/night/input.test.ts src/night/hud.test.ts`
Expected: FAIL — модули не найдены.

- [ ] **Step 2: `src/night/input.ts`**

```ts
import { LOOK, NIGHT } from '../config';

export type NightAction = 'doorLeft' | 'lightLeft' | 'vent' | 'lightRight' | 'doorRight' | 'monitor';

/** Только `event.code` — физическая клавиша: смена раскладки игру не ломает. */
const KEYS: Record<string, NightAction> = {
  KeyQ: 'doorLeft',
  KeyA: 'lightLeft',
  KeyW: 'vent',
  KeyD: 'lightRight',
  KeyE: 'doorRight',
  Space: 'monitor',
};

export function keyAction(code: string): NightAction | null {
  return KEYS[code] ?? null;
}

/** Доля ширины экрана у каждого края, где курсор поворачивает голову. */
const EDGE = 0.15;

/** Скорость поворота по положению курсора: 0 в середине, −1 у левого края, +1 у правого. */
export function edgePan(fraction: number): number {
  if (fraction < EDGE) return -(EDGE - fraction) / EDGE;
  if (fraction > 1 - EDGE) return (fraction - (1 - EDGE)) / EDGE;
  return 0;
}

export function clampYaw(yaw: number, center: number): number {
  return Math.max(center - NIGHT.lookLimit, Math.min(center + NIGHT.lookLimit, yaw));
}

/** Идут ли часы в этом кадре. Портрет на телефоне закрыт «Поверни телефон» — ночь ждёт. */
export function nightTicks(startVisible: boolean, portraitTouch: boolean): boolean {
  return !startVisible && !portraitTouch;
}

export interface NightInput {
  /** Поворот за кадр в радианах, положительный — влево. Копится между кадрами, забирается раз в кадр. */
  takeYaw(dt: number): number;
  onAction(handler: (action: NightAction) => void): void;
}

/**
 * Ввод офиса. Курсор не захватывается — кнопки надо кликать, — поэтому голову
 * поворачивает положение курсора у края экрана, как во FNAF. На телефоне —
 * горизонтальный свайп по канвасу; кнопки лежат выше канваса и свайпу не мешают.
 */
export function createNightInput(canvas: HTMLCanvasElement): NightInput {
  let pan = 0;
  let swipe = 0;
  let handler: (action: NightAction) => void = () => {};
  const lastX = new Map<number, number>();

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') {
      pan = edgePan(event.clientX / window.innerWidth);
      return;
    }
    const prev = lastX.get(event.pointerId);
    if (prev !== undefined) swipe += event.clientX - prev;
    lastX.set(event.pointerId, event.clientX);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') lastX.set(event.pointerId, event.clientX);
  });
  const forget = (event: PointerEvent): void => { lastX.delete(event.pointerId); };
  canvas.addEventListener('pointerup', forget);
  canvas.addEventListener('pointercancel', forget);
  // Курсор ушёл с канваса — на кнопку или за окно. У края его больше нет.
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') pan = 0;
  });

  window.addEventListener('keydown', (event) => {
    const action = keyAction(event.code);
    if (action === null) return;
    // Пробел иначе прокрутил бы страницу или нажал бы кнопку под фокусом.
    event.preventDefault();
    if (event.repeat) return;
    handler(action);
  });

  return {
    takeYaw(dt) {
      const turn = -pan * NIGHT.panSpeed * dt - swipe * LOOK.sensitivity * LOOK.touchGain;
      swipe = 0;
      return turn;
    },
    onAction(next) {
      handler = next;
    },
  };
}
```

- [ ] **Step 3: `src/night/hud.ts`**

```ts
import type { Night } from '../core/night';
import type { NightAction } from './input';

export function clockLabel(hour: number): string {
  return `${hour === 0 ? 12 : hour} AM`;
}

const BUTTONS: Record<NightAction, string> = {
  doorLeft: '#nb-door-left',
  lightLeft: '#nb-light-left',
  vent: '#nb-vent',
  lightRight: '#nb-light-right',
  doorRight: '#nb-door-right',
  monitor: '#nb-monitor',
};

export interface NightHud {
  show(): void;
  hide(): void;
  update(night: Night): void;
}

function el(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Разметка ночи не найдена: ${selector}`);
  return found;
}

/** Пишет в DOM, только когда значение изменилось: HUD обновляется каждый кадр. */
function setText(target: HTMLElement, text: string): void {
  if (target.textContent !== text) target.textContent = text;
}

export function createNightHud(act: (action: NightAction) => void): NightHud {
  const root = el('#night');
  const clock = el('#night-clock');
  const power = el('#night-power');
  const buttons = new Map<NightAction, HTMLElement>();

  for (const [action, selector] of Object.entries(BUTTONS) as Array<[NightAction, string]>) {
    const button = el(selector);
    // pointerdown, а не click: кнопка жмётся вторым пальцем, пока первый крутит
    // обзор (PR #11). preventDefault не даёт кнопке забрать фокус — иначе пробел
    // нажал бы её второй раз.
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      act(action);
    });
    buttons.set(action, button);
  }

  const on = (action: NightAction, value: boolean): void => {
    buttons.get(action)?.classList.toggle('on', value);
  };

  return {
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
    update(night) {
      setText(clock, clockLabel(night.hour));
      setText(power, `${Math.ceil(night.power)}%  ${'▮'.repeat(night.bars())}`);
      on('doorLeft', night.isClosed('left'));
      on('doorRight', night.isClosed('right'));
      on('vent', night.isClosed('vent'));
      on('lightLeft', night.isLit('left'));
      on('lightRight', night.isLit('right'));
      on('monitor', night.monitorUp);
      root.classList.toggle('monitor', night.monitorUp);
      root.classList.toggle('dead', night.status === 'blackout');
    },
  };
}
```

- [ ] **Step 4: `src/night/start.ts`**

```ts
export interface NightStart {
  isVisible(): boolean;
}

/**
 * Стартовый экран ночи — тот же `#start`, со своим текстом. Снимается первым
 * нажатием чего угодно. Это же нажатие дальше не идёт: иначе клавиша Q сняла бы
 * экран И закрыла бы дверь, а тап по кнопке — нажал бы её (Review Focus 3).
 */
export function createNightStart(coarse: boolean, onStart: () => void): NightStart {
  const root = document.querySelector<HTMLElement>('#start');
  const title = document.querySelector<HTMLElement>('#start-title');
  const action = document.querySelector<HTMLElement>('#start-action');
  const rotate = document.querySelector<HTMLElement>('#rotate');
  if (!root || !title || !action) throw new Error('Разметка стартового экрана не найдена.');

  title.textContent = 'НОЧЬ 1';
  action.textContent = coarse ? 'Коснись, чтобы начать' : 'Нажми, чтобы начать';
  for (const id of ['#start-explore-desktop', '#start-explore-touch']) {
    document.querySelector(id)?.setAttribute('hidden', '');
  }
  for (const id of ['#start-night-desktop', '#start-night-touch']) {
    document.querySelector(id)?.removeAttribute('hidden');
  }

  let visible = true;

  function begin(event: Event): void {
    if (!visible) return;
    // Тап по «поверни телефон» — это поворот телефона, а не начало ночи.
    if (rotate && event.target instanceof Node && rotate.contains(event.target)) return;
    event.stopPropagation();
    visible = false;
    root!.hidden = true;
    onStart();
  }

  // capture на window: срабатывает раньше обработчиков кнопок и клавиш.
  window.addEventListener('pointerdown', begin, { capture: true });
  window.addEventListener('keydown', begin, { capture: true });

  return { isVisible: () => visible };
}
```

- [ ] **Step 5: Разметка и стили**

В `index.html`:

1. Существующим спискам стартового экрана добавить id: `<ul class="for-desktop" id="start-explore-desktop">` и `<ul class="for-touch" id="start-explore-touch">`.
2. Сразу после них в `#start`:

```html
      <ul class="for-desktop" id="start-night-desktop" hidden>
        <li>Продержись до 6 утра</li>
        <li>Мышь к краю экрана — повернуть голову</li>
        <li>Q / E — левая / правая дверь</li>
        <li>A / D — свет у левой / правой двери</li>
        <li>W — заслонка вентиляции</li>
        <li>Пробел — монитор камер</li>
      </ul>
      <ul class="for-touch" id="start-night-touch" hidden>
        <li>Продержись до 6 утра</li>
        <li>Свайп — повернуть голову</li>
        <li>Кнопки по краям — двери и свет</li>
        <li>«Вент» — заслонка вентиляции</li>
        <li>«Монитор» — камеры</li>
      </ul>
```

3. Перед `<div id="dread">`:

```html
    <div id="night" hidden>
      <div id="night-clock">12 AM</div>
      <div id="night-power">100%</div>
      <button id="nb-door-left" class="night-btn side" type="button" tabindex="-1"><span class="for-desktop">Q · </span>Дверь</button>
      <button id="nb-light-left" class="night-btn side" type="button" tabindex="-1"><span class="for-desktop">A · </span>Свет</button>
      <button id="nb-vent" class="night-btn side" type="button" tabindex="-1"><span class="for-desktop">W · </span>Вент</button>
      <button id="nb-door-right" class="night-btn side" type="button" tabindex="-1"><span class="for-desktop">E · </span>Дверь</button>
      <button id="nb-light-right" class="night-btn side" type="button" tabindex="-1"><span class="for-desktop">D · </span>Свет</button>
      <button id="nb-monitor" class="night-btn" type="button" tabindex="-1"><span class="for-desktop">Пробел · </span>▲ Монитор ▲</button>
    </div>
```

4. В `<style>` перед правилом `#fatal`:

```css
      /* `.for-touch { display: block }` в медиазапросе перебил бы атрибут hidden:
         авторский стиль сильнее встроенного [hidden]. Id поднимает специфичность. */
      #start ul[hidden] { display: none; }
      /* Ночной режим (уровень 4). Выше монитора (6): часы, энергия и кнопка
         монитора видны и поверх камер. Ниже старта (8), финалов (21) и «поверни
         телефон» (30). */
      #night { position: fixed; inset: 0; z-index: 7; pointer-events: none;
               color: #f2f2f2; font: 600 18px/1.3 system-ui, sans-serif; }
      #night[hidden] { display: none; }
      #night-clock { position: absolute; font-size: 26px;
                     left: calc(20px + env(safe-area-inset-left));
                     top: calc(16px + env(safe-area-inset-top)); }
      #night-power { position: absolute;
                     right: calc(20px + env(safe-area-inset-right));
                     top: calc(16px + env(safe-area-inset-top)); }
      .night-btn { position: fixed; pointer-events: auto; border: none;
                   border-radius: 12px; background: rgba(255,255,255,0.18);
                   color: #fff; font: 600 16px system-ui, sans-serif;
                   min-width: 96px; min-height: 64px; touch-action: none;
                   user-select: none; -webkit-user-select: none; }
      .night-btn.on { background: rgba(255,212,121,0.55); color: #1a1a1a; }
      #nb-door-left, #nb-light-left { left: calc(20px + env(safe-area-inset-left)); }
      #nb-door-right, #nb-light-right { right: calc(20px + env(safe-area-inset-right)); }
      /* 64 + 12 зазора: промах пальцем между дверью и светом — это открытая дверь. */
      #nb-door-left, #nb-door-right { top: calc(50% - 76px); }
      #nb-light-left, #nb-light-right { top: calc(50% + 12px); }
      #nb-vent { left: 50%; transform: translateX(-50%);
                 top: calc(16px + env(safe-area-inset-top)); }
      #nb-monitor { left: 50%; transform: translateX(-50%); min-width: 220px;
                    bottom: calc(16px + env(safe-area-inset-bottom)); }
      /* Пока поднят монитор, двери и свет не нажимаются (правило ядра) — и не видны.
         Без энергии не нажимается ничего. */
      #night.monitor .side, #night.dead .night-btn { visibility: hidden; }
```

- [ ] **Step 6: Подключить в `run.ts`**

Импорты:

```ts
import { isCoarsePointer } from '../input';
import { createNightHud } from './hud';
import { clampYaw, createNightInput, nightTicks, type NightAction } from './input';
import { createNightStart } from './start';
```

После создания `officeCamera` и `yaw`:

```ts
  const act = (action: NightAction): void => {
    switch (action) {
      case 'doorLeft': night.toggleShutter('left'); break;
      case 'doorRight': night.toggleShutter('right'); break;
      case 'vent': night.toggleShutter('vent'); break;
      case 'lightLeft': night.toggleLight('left'); break;
      case 'lightRight': night.toggleLight('right'); break;
      case 'monitor': night.toggleMonitor(); break;
    }
  };
  const input = createNightInput(ctx.canvas);
  input.onAction(act);
  const hud = createNightHud(act);
  const start = createNightStart(isCoarsePointer(), () => {});
  hud.show();

  // «Поверни телефон» уже есть в разметке и показывается CSS только в портрете
  // на тач-экране; здесь его лишь разрешаем, как делает тач-схема исследования.
  if (isCoarsePointer()) document.querySelector('#rotate')?.removeAttribute('hidden');
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
```

В цикле заменить `night.step(dt);` на:

```ts
      if (nightTicks(start.isVisible(), portrait.matches)) {
        night.step(dt);
        yaw = clampYaw(yaw + input.takeYaw(dt), level.spawn.yaw);
      } else {
        input.takeYaw(dt); // накопленное за паузу не должно дёрнуть голову после неё
      }
      hud.update(night);
```

- [ ] **Step 7: Прогнать тесты и сборку**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 8: Проверка глазами (десктоп и телефон)**

Run: `npm run dev -- --host`, открыть `#level_04` на десктопе и на телефоне.
Expected:
- Стартовый экран «НОЧЬ 1» со списком управления ночи. Первое нажатие Q или тап по кнопке только снимает его: дверь не закрывается.
- Десктоп: курсор у левого или правого края поворачивает голову, не дальше ±70°. Q/E/W опускают и поднимают шторки, A/D включают свет в проёмах. Пробел поднимает «монитор»: кнопки дверей и света исчезают, Q ничего не делает. Страница не прокручивается.
- Телефон, горизонтально: свайп поворачивает голову. Кнопки 96×64, жмутся вторым пальцем. В портрете — «Поверни телефон», и часы стоят.
- Часы идут, энергия падает быстрее с закрытыми дверьми.
- Монстр, дошедший до двери, виден в проёме только при включённом свете с этой стороны.

Сообщить пользователю и ждать подтверждения.

- [ ] **Step 9: Commit**

```bash
git add index.html src/night/
git commit -m "Ночь: кнопки, хоткеи, поворот головы, стартовый экран"
```

---

### Task 6: Монитор камер

**Files:**
- Create: `src/night/map.ts`
- Test: `src/night/map.test.ts`
- Create: `src/night/monitor.ts`
- Modify: `src/night/run.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: `Night.monitorUp`, `Night.camera`, `Night.staticLeft`, `Night.selectCamera`, `NIGHT.cameraHeight`.
- Produces:
  - `map.ts`: `export const MAP_WIDTH = 320`, `export const MAP_HEIGHT = 230`, `export const CAM_BUTTON = 44`, `mapLayout(level, def, width, height, pad?): MapLayout`, `interface MapLayout { rooms: Array<{ id; office; x; y; w; h }>; cameras: Array<{ id; x; y }> }`
  - `monitor.ts`: `createMonitor(level, def, select): Monitor` с `show()`, `hide()`, `update(night)`.

- [ ] **Step 1: Падающий тест раскладки**

`src/night/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { CAM_BUTTON, MAP_HEIGHT, MAP_WIDTH, mapLayout } from './map';

function level04() {
  const loaded = loadLevel('level_04');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  return { level: loaded.level, def: loaded.level.night! };
}

describe('mapLayout', () => {
  it('все комнаты внутри карты', () => {
    const { level, def } = level04();
    const { rooms } = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
    expect(rooms).toHaveLength(level.rooms.length);
    for (const r of rooms) {
      expect(r.x, r.id).toBeGreaterThanOrEqual(0);
      expect(r.y, r.id).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, r.id).toBeLessThanOrEqual(MAP_WIDTH + 1e-9);
      expect(r.y + r.h, r.id).toBeLessThanOrEqual(MAP_HEIGHT + 1e-9);
    }
  });

  it('офис помечен', () => {
    const { level, def } = level04();
    const { rooms } = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
    expect(rooms.filter((r) => r.office).map((r) => r.id)).toEqual(['office']);
  });

  // Квадратики — цель для пальца: слипшиеся на телефоне не нажать по отдельности.
  it('квадратики камер не налезают друг на друга', () => {
    const { level, def } = level04();
    const { cameras } = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
    for (let i = 0; i < cameras.length; i++) {
      for (let j = i + 1; j < cameras.length; j++) {
        const a = cameras[i]!;
        const b = cameras[j]!;
        const apart = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        expect(apart, `${a.id} и ${b.id}`).toBeGreaterThanOrEqual(CAM_BUTTON);
      }
    }
  });
});
```

Run: `npx vitest run src/night/map.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 2: `src/night/map.ts`**

```ts
import type { Level, NightDef } from '../core/types';
import { roomBounds } from '../core/validate';

/** Размер карты на мониторе, CSS px. Помещается в горизонтальный телефон над кнопкой монитора. */
export const MAP_WIDTH = 320;
export const MAP_HEIGHT = 230;
/** Сторона квадратика камеры, CSS px. */
export const CAM_BUTTON = 44;

export interface MapLayout {
  rooms: Array<{ id: string; office: boolean; x: number; y: number; w: number; h: number }>;
  cameras: Array<{ id: string; x: number; y: number }>;
}

/**
 * Комнаты уровня, вписанные в прямоугольник карты с сохранением пропорций. Ось z
 * уровня идёт вниз по карте — как на рисунке. Квадратик камеры стоит посередине
 * между камерой и точкой, куда она смотрит: камеры висят в углах, и по месту
 * подвеса соседние квадратики слиплись бы.
 */
export function mapLayout(level: Level, def: NightDef, width: number, height: number, pad = 12): MapLayout {
  const bounds = level.rooms.map(roomBounds);
  const x0 = Math.min(...bounds.map((b) => b.x0));
  const x1 = Math.max(...bounds.map((b) => b.x1));
  const z0 = Math.min(...bounds.map((b) => b.z0));
  const z1 = Math.max(...bounds.map((b) => b.z1));
  const scale = Math.min((width - 2 * pad) / (x1 - x0), (height - 2 * pad) / (z1 - z0));
  const ox = (width - (x1 - x0) * scale) / 2;
  const oy = (height - (z1 - z0) * scale) / 2;
  const px = (x: number): number => ox + (x - x0) * scale;
  const py = (z: number): number => oy + (z - z0) * scale;

  return {
    rooms: level.rooms.map((room) => {
      const b = roomBounds(room);
      return {
        id: room.id,
        office: room.id === def.office,
        x: px(b.x0),
        y: py(b.z0),
        w: (b.x1 - b.x0) * scale,
        h: (b.z1 - b.z0) * scale,
      };
    }),
    cameras: def.cameras.map((cam) => ({
      id: cam.id,
      x: px((cam.at[0] + cam.look[0]) / 2),
      y: py((cam.at[1] + cam.look[1]) / 2),
    })),
  };
}
```

Run: `npx vitest run src/night/map.test.ts`
Expected: PASS. Если «не налезают» падает — развести `look` соседних камер в `level_04.json`, а не уменьшать `CAM_BUTTON`.

- [ ] **Step 3: `src/night/monitor.ts`**

```ts
import type { Night } from '../core/night';
import type { Level, NightDef } from '../core/types';
import { MAP_HEIGHT, MAP_WIDTH, mapLayout } from './map';

export interface Monitor {
  show(): void;
  hide(): void;
  update(night: Night): void;
}

function el(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Разметка монитора не найдена: ${selector}`);
  return found;
}

/** Квадрат шума один раз; каждый кадр он лишь сдвигается — это дешевле, чем рисовать заново. */
function noiseUrl(): string {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return '';
  const image = g.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function createMonitor(level: Level, def: NightDef, select: (id: string) => void): Monitor {
  const root = el('#monitor');
  const grain = el('#monitor-grain');
  const label = el('#monitor-cam');
  const map = el('#monitor-map');

  grain.style.backgroundImage = `url(${noiseUrl()})`;

  const layout = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
  for (const room of layout.rooms) {
    const box = document.createElement('div');
    box.className = room.office ? 'map-room office' : 'map-room';
    box.style.left = `${room.x}px`;
    box.style.top = `${room.y}px`;
    box.style.width = `${room.w}px`;
    box.style.height = `${room.h}px`;
    if (room.office) box.textContent = 'ТЫ';
    map.append(box);
  }
  const buttons = new Map<string, HTMLButtonElement>();
  for (const cam of layout.cameras) {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'map-cam';
    button.textContent = cam.id;
    button.style.left = `${cam.x}px`;
    button.style.top = `${cam.y}px`;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      select(cam.id);
    });
    map.append(button);
    buttons.set(cam.id, button);
  }

  let shownCamera = '';

  return {
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
    update(night) {
      if (night.camera !== shownCamera) {
        shownCamera = night.camera;
        label.textContent = `CAM ${night.camera}`;
        for (const [id, button] of buttons) button.classList.toggle('on', id === night.camera);
      }
      grain.style.backgroundPosition = `${Math.random() * 128}px ${Math.random() * 128}px`;
      grain.style.opacity = night.staticLeft > 0 ? '0.9' : '0.18';
    },
  };
}
```

- [ ] **Step 4: Разметка и стили**

В `index.html` перед `<div id="night" hidden>`:

```html
    <div id="monitor" hidden>
      <div id="monitor-grain"></div>
      <div id="monitor-scan"></div>
      <div id="monitor-rec">● REC</div>
      <div id="monitor-cam">CAM 1</div>
      <div id="monitor-map"></div>
    </div>
```

В `<style>` после правил `#night`:

```css
      /* Планшет поверх кадра с камеры: сам кадр рисует канвас, здесь только
         зерно, полосы, подписи и карта. Ниже HUD ночи (7). */
      #monitor { position: fixed; inset: 0; z-index: 6; pointer-events: none;
                 color: #f2f2f2; font: 600 18px ui-monospace, monospace; }
      #monitor[hidden] { display: none; }
      #monitor-grain { position: absolute; inset: 0; opacity: 0.18; mix-blend-mode: screen; }
      #monitor-scan { position: absolute; inset: 0;
                      background: repeating-linear-gradient(to bottom,
                        rgba(0,0,0,0.25) 0 2px, transparent 2px 4px); }
      #monitor-rec { position: absolute; color: #ff4a4a;
                     left: calc(20px + env(safe-area-inset-left));
                     top: calc(60px + env(safe-area-inset-top));
                     animation: rec-blink 1s steps(2) infinite; }
      @keyframes rec-blink { 50% { opacity: 0; } }
      #monitor-cam { position: absolute; font-size: 22px;
                     left: calc(20px + env(safe-area-inset-left));
                     top: calc(90px + env(safe-area-inset-top)); }
      /* Размер — MAP_WIDTH × MAP_HEIGHT из src/night/map.ts. */
      #monitor-map { position: absolute; width: 320px; height: 230px;
                     right: calc(16px + env(safe-area-inset-right));
                     bottom: calc(92px + env(safe-area-inset-bottom));
                     pointer-events: auto; background: rgba(0,0,0,0.4); border-radius: 8px; }
      .map-room { position: absolute; box-sizing: border-box;
                  border: 2px solid rgba(255,255,255,0.7); }
      .map-room.office { display: flex; align-items: center; justify-content: center;
                         font: 600 12px system-ui, sans-serif; }
      /* Сторона — CAM_BUTTON из src/night/map.ts. */
      .map-cam { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px;
                 border: 2px solid #fff; border-radius: 6px; background: rgba(40,40,40,0.9);
                 color: #fff; font: 600 16px system-ui, sans-serif; touch-action: none; }
      .map-cam.on { background: #3fa34d; }
```

- [ ] **Step 5: Подключить в `run.ts`**

Импорт:

```ts
import { createMonitor } from './monitor';
```

После `hud.show();`:

```ts
  const monitor = createMonitor(level, def, (id) => night.selectCamera(id));
  const feedCamera = new THREE.PerspectiveCamera(75, 1, 0.05, 60);
```

В `resize()` после обновления `officeCamera`:

```ts
    feedCamera.aspect = width / height;
    feedCamera.updateProjectionMatrix();
```

В цикле заменить три строки

```ts
      monsters.update(night, 'office');
      officeCamera.rotation.set(OFFICE_PITCH, yaw, 0);
      renderer.render(scene, officeCamera);
```

на

```ts
      // После поимки или победы — только офис, даже если монитор был поднят.
      const feed = night.monitorUp && night.status === 'running';
      monsters.update(night, feed ? 'feed' : 'office');
      if (feed) {
        const cam = def.cameras.find((c) => c.id === night.camera)!;
        feedCamera.position.set(cam.at[0], NIGHT.cameraHeight, cam.at[1]);
        feedCamera.lookAt(cam.look[0], 0.8, cam.look[1]);
        monitor.show();
        monitor.update(night);
        renderer.render(scene, feedCamera);
      } else {
        monitor.hide();
        officeCamera.rotation.set(OFFICE_PITCH, yaw, 0);
        renderer.render(scene, officeCamera);
      }
```

- [ ] **Step 6: Прогнать тесты и сборку**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Проверка глазами**

Run: `npm run dev -- --host`, открыть `#level_04` на десктопе и телефоне.
Expected:
- Пробел или кнопка «Монитор» — во весь экран кадр с камеры, зерно, полосы, мигающий `● REC`, `CAM 1`. Справа внизу карта: шесть комнат как на рисунке, офис подписан «ТЫ», девять квадратиков.
- Тап по квадратику переключает камеру, выбранный зелёный. Квадратики нажимаются пальцем по отдельности.
- На камере 1 видны три монстра на помосте, на камере 4 — серый. Каждая камера показывает свою комнату, не стену вплотную.
- Монстр вошёл в смотримую комнату или вышел из неё — секунда помех.
- На камерах 6/7 и 8/9 монстр у двери офиса виден без всякого света.
- Опустил монитор — снова офис, кнопки дверей на месте.

Если какая-то камера смотрит в стену или комнату не разглядеть, поправить `at`/`look` в `level_04.json` (тест `map.test.ts` при этом должен остаться зелёным). Сообщить пользователю и ждать подтверждения.

- [ ] **Step 8: Commit**

```bash
git add index.html src/night/ src/levels/level_04.json
git commit -m "Ночь: монитор камер с картой по рисунку"
```

---

### Task 7: Скример, звук, затемнение, 6 AM

**Files:**
- Create: `src/audio/night.ts`
- Create: `src/night/jumpscare.ts`
- Modify: `src/night/run.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: события `Night` (`caught`, `blackout`, `won`), `createMonsterMesh` (задача 4), `nextLevelId`.
- Produces:
  - `audio/night.ts`: `createNightAudio(): NightAudio` с `unlock()`, `thunk()`, `scream()`, `chime()`.
  - `jumpscare.ts`: `createJumpscare(scene): Jumpscare` с `start(color, camera)`, `active(): boolean`, `update(dt, camera): boolean` (true — скример закончился).

- [ ] **Step 1: `src/audio/night.ts`**

```ts
export interface NightAudio {
  unlock(): void;
  /** Лязг заслонки. */
  thunk(): void;
  /** Крик скримера, около секунды. */
  scream(): void;
  /** Колокольчик 6 AM. */
  chime(): void;
}

/**
 * Звуки ночи. Файлов нет — как и шаги антагониста, всё синтезируется. Если
 * `AudioContext` не создался, звука просто нет: скример и 6 AM работают и без
 * него (спека §4).
 */
export function createNightAudio(): NightAudio {
  let ctx: AudioContext | null = null;

  function unlock(): void {
    if (ctx) { void ctx.resume(); return; }
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }

  function noise(c: AudioContext, seconds: number): AudioBufferSourceNode {
    const frames = Math.floor(c.sampleRate * seconds);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  function envelope(c: AudioContext, peak: number, attack: number, length: number): GainNode {
    const gain = c.createGain();
    const t = c.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    gain.connect(c.destination);
    return gain;
  }

  return {
    unlock,
    thunk() {
      if (!ctx) return;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      const source = noise(ctx, 0.18);
      source.connect(filter).connect(envelope(ctx, 0.5, 0.005, 0.18));
      source.start();
    },
    scream() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const gain = envelope(ctx, 0.9, 0.03, 1.0);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(400, t + 1.0);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 1.05);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 0.7;
      const hiss = noise(ctx, 1.0);
      hiss.connect(filter).connect(gain);
      hiss.start(t);
    },
    chime() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [660, 880, 1320].forEach((freq, i) => {
        const osc = ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx!.createGain();
        const start = t + i * 0.35;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(start);
        osc.stop(start + 0.85);
      });
    },
  };
}
```

- [ ] **Step 2: `src/night/jumpscare.ts`**

```ts
import * as THREE from 'three';
import { createMonsterMesh } from './scene';

const SCARE_SECONDS = 1.0;
const SHAKE = 0.06;

export interface Jumpscare {
  start(color: string, camera: THREE.PerspectiveCamera): void;
  active(): boolean;
  /** Трясёт камеру. true — скример кончился, пора показывать экран поимки. */
  update(dt: number, camera: THREE.PerspectiveCamera): boolean;
}

export function createJumpscare(scene: THREE.Scene): Jumpscare {
  let left = 0;
  let running = false;
  const base = new THREE.Vector3();

  return {
    start(color, camera) {
      const mesh = createMonsterMesh(color);
      const yaw = camera.rotation.y;
      // Вплотную перед лицом, головой (1.5 м от ног) на уровне глаз, лицом к игроку.
      const ahead = 0.55;
      mesh.group.position.set(
        camera.position.x - Math.sin(yaw) * ahead,
        camera.position.y - 1.5,
        camera.position.z - Math.cos(yaw) * ahead,
      );
      mesh.group.rotation.y = yaw + Math.PI;
      scene.add(mesh.group);
      base.copy(camera.position);
      left = SCARE_SECONDS;
      running = true;
    },
    active: () => running,
    update(dt, camera) {
      left -= dt;
      camera.position.set(
        base.x + (Math.random() - 0.5) * SHAKE,
        base.y + (Math.random() - 0.5) * SHAKE,
        base.z,
      );
      if (left > 0) return false;
      running = false;
      camera.position.copy(base);
      return true;
    },
  };
}
```

- [ ] **Step 3: Разметка и стили**

В `index.html` сразу после `</div>` блока `#night`:

```html
    <div id="night-dark"></div>
    <div id="night-sixam" hidden>6 AM</div>
```

В `<style>` после правил монитора:

```css
      /* Конец энергии. Монитор в затемнении опущен ядром, поэтому делить слой
         с ним (6) безопасно: вместе они не бывают. */
      #night-dark { position: fixed; inset: 0; z-index: 6; background: #000;
                    opacity: 0; pointer-events: none; transition: opacity 1.2s; }
      #night-dark.on { opacity: 0.93; }
      /* Ниже экранов финала (21): через 2.5 с его сменяет экран победы. */
      #night-sixam { position: fixed; inset: 0; z-index: 20; display: flex;
                     align-items: center; justify-content: center; background: #000;
                     color: #f2f2f2; font: 700 72px system-ui, sans-serif; }
      #night-sixam[hidden] { display: none; }
```

- [ ] **Step 4: Подключить в `run.ts`**

Импорты:

```ts
import { nextLevelId } from '../levels';
import { createNightAudio } from '../audio/night';
import { createJumpscare } from './jumpscare';
```

Звук заводится первым жестом — тем же, что снимает стартовый экран. Заменить создание старта:

```ts
  const audio = createNightAudio();
  const start = createNightStart(isCoarsePointer(), () => audio.unlock());
```

В `act` звучит лязг только при принятом нажатии заслонки:

```ts
      case 'doorLeft': if (night.toggleShutter('left')) audio.thunk(); break;
      case 'doorRight': if (night.toggleShutter('right')) audio.thunk(); break;
      case 'vent': if (night.toggleShutter('vent')) audio.thunk(); break;
```

После создания монитора — финалы:

```ts
  const jumpscare = createJumpscare(scene);
  const dark = document.querySelector<HTMLElement>('#night-dark');
  const sixam = document.querySelector<HTMLElement>('#night-sixam');
  const winEl = document.querySelector<HTMLElement>('#win');
  const caughtEl = document.querySelector<HTMLElement>('#caught');
  if (!dark || !sixam || !winEl || !caughtEl) throw new Error('Разметка финала ночи не найдена.');

  document.querySelector('#caught-again')?.addEventListener('click', () => location.reload());
  const nextButton = document.querySelector<HTMLButtonElement>('#win-next');
  const againEl = document.querySelector<HTMLElement>('#win-again');
  const nextId = nextLevelId(level.id);
  if (nextButton && nextId !== null) {
    nextButton.addEventListener('click', () => {
      location.hash = nextId;
      location.reload();
    });
  }

  function hideControls(): void {
    hud.hide();
    monitor.hide();
    dark!.classList.remove('on');
    document.querySelector('#rotate')?.setAttribute('hidden', '');
  }

  night.on((event) => {
    if (event.kind === 'blackout') dark.classList.add('on');
    if (event.kind === 'caught') {
      hideControls();
      const color = def.monsters.find((m) => m.id === event.monster)?.color ?? '#ffffff';
      jumpscare.start(color, officeCamera);
      audio.scream();
    }
    if (event.kind === 'won') {
      hideControls();
      audio.chime();
      sixam.hidden = false;
      ctx.stopLoop();
      window.setTimeout(() => {
        sixam.hidden = true;
        const text = winEl.querySelector('p');
        if (text) text.textContent = '6 AM. Ты продержался до утра.';
        winEl.hidden = false;
        if (nextButton && nextId !== null) {
          nextButton.hidden = false;
          if (againEl) againEl.hidden = true;
        }
      }, 2500);
    }
  });
```

В цикле, сразу после `hud.update(night);`:

```ts
      if (jumpscare.active() && jumpscare.update(dt, officeCamera)) {
        const text = caughtEl.querySelector('p');
        if (text) text.textContent = 'Тебя поймали.';
        caughtEl.hidden = false;
        ctx.stopLoop();
        return;
      }
```

Скример идёт в офисном виде: `feed` в цикле уже ложен при `status !== 'running'`.

- [ ] **Step 5: Прогнать тесты и сборку**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Проверка глазами и ушами**

Для скорой проверки финалов можно временно поставить `hourSeconds: 10` в `NIGHT`, **не коммитить**.

Run: `npm run dev -- --host`, `#level_04`, десктоп и телефон в наушниках.
Expected:
- Шторка лязгает при закрытии и открытии. Нажатие, отвергнутое при поднятом мониторе, не звучит.
- Поимка: монстр своего цвета вплотную перед лицом, тряска, крик около секунды, затем экран «Тебя поймали.», и «Ещё раз» перезапускает ночь.
- Поймали при поднятом мониторе — скример всё равно в офисе.
- Энергия на нуле: офис гаснет, кнопки пропадают, через 5–20 с скример красного.
- 6 AM: колокольчик, крупно «6 AM», через 2.5 с экран победы «6 AM. Ты продержался до утра.» и «Это был последний уровень…».
- Без звука (выключенный звук вкладки) всё то же, только тихо.

Вернуть `hourSeconds: 60`. Сообщить пользователю и ждать подтверждения.

- [ ] **Step 7: Commit**

```bash
git add index.html src/audio/night.ts src/night/
git commit -m "Ночь: скример, затемнение, 6 AM и звуки"
```

---

### Task 8: Документация

**Files:**
- Modify: `CLAUDE.md`
- Modify: `known-issues.md`

- [ ] **Step 1: `CLAUDE.md`**

Прочитать файл целиком и внести:

1. «Что это» — абзац: четвёртый уровень — ночной режим в духе FNAF по рисунку сына пользователя. Игрок сидит в офисе, смотрит камеры, закрывает две двери и заслонку вентиляции и держится до 6 AM. Спека — `docs/superpowers/specs/2026-09-30-bandy-night-design.md`, план — `docs/superpowers/plans/2026-09-30-bandy-night.md`.
2. «Главное правило архитектуры» — абзац про развилку: `main.ts` создаёт общее и передаёт управление `runExplore` (`src/explore.ts`) или `runNight` (`src/night/run.ts`) по наличию `level.night`. Ядро ночи — `src/core/night.ts`, без three.js, случайность подаётся снаружи.
3. «Формат уровня» — «Уровней три» → «Уровней четыре», плюс `level_04` (пиццерия). Абзац про блок `night`: заслонки, камеры, монстры, помост; что у офиса нет дверей, кроме заслонок; что ночному уровню не нужен выход; что первый монстр в списке приходит при нуле энергии.
4. Новый раздел «Ночной режим» рядом с «Антагонистом»: числа живут в `NIGHT` и настраиваются только на устройстве; баланс сторожит `walkthrough-04.test.ts` («аккуратный» игрок обязан доживать до 6 AM на всех зёрнах); правило видимости в проёме решается видимостью меша (`src/night/pose.ts`), а не светом, и почему; квадратики камер на карте — посередине между `at` и `look`.

- [ ] **Step 2: `known-issues.md`**

Прочитать файл целиком, затем добавить раздел в его стиле: что сделано, что отложено, почему, чего стоит ошибка.
- **Живая проверка задач 4–7 не пройдена** — чек-лист глазами из шагов «Проверка глазами» этого плана.
- **Вентиляция — узкий ход под потолком 3 м.** Для трубы нужно поле высоты комнат (спека §10).
- **Сцена прямоугольная**, полукруг не строится.
- **На десктопе нет паузы**: курсор не захвачен, Escape ничего не ставит на паузу, ночь стоит только при уходе вкладки в фон.
- **Первые шаги монстров быстрые**: при стартовых числах бездельника ловят на 30–65-й секунде. Для первой ночи это может быть жёстко — настраивается `aggression` в JSON и `NIGHT.opportunitySeconds`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md known-issues.md
git commit -m "Документация: ночной режим и уровень 4"
```

---

## Проверка покрытия спеки

| Спека | Задача |
|---|---|
| §1 отмена «антагонист на 4-м», несовместимость блоков | 1 (правило 8), 8 |
| §3 комнаты, двери, маршруты, помост | 3, 4 |
| §4 время, энергия, броски, заслонки, свет, монитор, затемнение, скример, победа | 2, 4, 5, 7 |
| §5 кнопки, хоткеи, поворот, монитор, карта, старт, «Поверни телефон» | 5, 6 |
| §6 формат `night` и правила 1–8, отключение проверки выхода | 1 |
| §7 архитектура, пол, `buildExitGlow` без триггеров (он и так ничего не строит без `win`-триггера) | 4 |
| §8 машинная проверка и сквозная ночь | 1, 2, 3, 4, 5, 6 |
| §9 порядок работ | задачи 1–8 |
