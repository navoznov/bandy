import { describe, expect, it } from 'vitest';
import {
  clampInside, doorWaypoints, pathDistance, roomPath, roomAt, roomCenter, INSET,
} from './pathing';
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

/**
 * Развилка: из `hub` в `far` ведут два пути — короткий через `east` и длинный
 * в обход через три комнаты. На графе из двух комнат BFS неотличим от любого
 * другого обхода, поэтому «кратчайшая цепочка» проверяется только здесь.
 */
function forkLevel(): Level {
  const raw = {
    id: 'fixture_fork',
    spawn: { room: 'hub', x: 2, z: 2, yaw: 0 },
    rooms: [
      { id: 'hub',   rect: [0, 0, 4, 4],  color: '#888888', light: 1 },
      { id: 'east',  rect: [4, 0, 4, 4],  color: '#888888', light: 1 },
      { id: 'far',   rect: [8, 0, 4, 4],  color: '#888888', light: 1 },
      { id: 'loopA', rect: [0, 4, 4, 4],  color: '#888888', light: 1 },
      { id: 'loopB', rect: [4, 4, 4, 4],  color: '#888888', light: 1 },
      { id: 'loopC', rect: [8, 4, 4, 4],  color: '#888888', light: 1 },
    ],
    doors: [
      { id: 'd_hub_east',    between: ['hub', 'east'],     at: [4, 2] },
      { id: 'd_east_far',    between: ['east', 'far'],     at: [8, 2] },
      { id: 'd_hub_loopA',   between: ['hub', 'loopA'],    at: [2, 4] },
      { id: 'd_loopA_loopB', between: ['loopA', 'loopB'],  at: [4, 6] },
      { id: 'd_loopB_loopC', between: ['loopB', 'loopC'],  at: [8, 6] },
      { id: 'd_loopC_far',   between: ['loopC', 'far'],    at: [10, 4] },
    ],
    locks: {},
    items: [],
    triggers: [{ id: 'win', room: 'far', rect: [8, 0, 4, 4], effect: 'win' }],
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

  it('на вертикальной стене отступ идёт по X, и знак зависит от стороны', () => {
    const level = forkLevel();
    const door = level.doors.find((d) => d.id === 'd_hub_east')!;

    // `hub` лежит слева от стены x = 4, значит внутрь него — в сторону меньших x.
    const [inHub, inEast] = doorWaypoints(level, door, 'hub');
    expect(inHub).toEqual({ x: 4 - INSET, z: 2 });
    expect(inEast).toEqual({ x: 4 + INSET, z: 2 });

    // Из соседней комнаты те же две точки, но в обратном порядке.
    const [firstFromEast, secondFromEast] = doorWaypoints(level, door, 'east');
    expect(firstFromEast).toEqual({ x: 4 + INSET, z: 2 });
    expect(secondFromEast).toEqual({ x: 4 - INSET, z: 2 });
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

  it('из двух путей возвращает короткий, а не любой', () => {
    const level = forkLevel();
    expect(roomPath(level, 'hub', 'far', () => true)).toEqual(['hub', 'east', 'far']);
  });

  it('закрыв короткий путь, находит длинный в обход', () => {
    const level = forkLevel();
    const path = roomPath(level, 'hub', 'far', (d) => d.id !== 'd_hub_east');
    expect(path).toEqual(['hub', 'loopA', 'loopB', 'loopC', 'far']);
  });
});

describe('расстояние по графу комнат', () => {
  it('считается от переданных точек, а не от центров комнат', () => {
    const level = longRoomLevel();
    const from = { x: 1, z: 3 };    // в `hall`
    const to = { x: 19, z: 7 };     // в дальнем конце `long`

    // Путь: from -> центр `long` (10, 7) -> to. Это 9.849 + 9 = 18.849.
    // По прямой было бы 18.439 — расстояние обязано отличаться от неё, иначе
    // виньетка тревожила бы игрока сквозь стены.
    expect(pathDistance(level, from, to, () => true)).toBeCloseTo(18.849, 2);
    expect(Math.hypot(to.x - from.x, to.z - from.z)).toBeCloseTo(18.439, 2);
  });

  it('без прохода расстояния нет', () => {
    const level = longRoomLevel();
    expect(pathDistance(level, { x: 1, z: 3 }, { x: 19, z: 7 }, () => false)).toBe(null);
  });

  it('точка вне всех комнат расстояния не имеет', () => {
    const level = longRoomLevel();
    expect(pathDistance(level, { x: 1, z: 3 }, { x: 100, z: 100 }, () => true)).toBe(null);
  });
});

describe('точка, до которой можно дойти телом', () => {
  const room = { id: 'r', rect: [10, 4, 6, 8], color: '#888888', light: 1 } as const;

  it('точку внутри комнаты не двигает вовсе', () => {
    // Игрок и так не подходит к стене ближе INSET: его собственный радиус плюс
    // толщина стены дают ровно тот же отступ. Для любой его законной позиции
    // отжатие обязано быть тождеством, иначе антагонист целился бы мимо.
    expect(clampInside(room, { x: 13, z: 8 })).toEqual({ x: 13, z: 8 });
    expect(clampInside(room, { x: 10 + INSET, z: 4 + INSET }))
      .toEqual({ x: 10 + INSET, z: 4 + INSET });
  });

  it('точку в полосе стены отжимает на порог проёма', () => {
    // Игрок в дверном проёме стоит внутри полосы стены на законных основаниях:
    // там дыра. Прямая к нему прошла бы сквозь стену рядом с дырой.
    expect(clampInside(room, { x: 10.05, z: 9 })).toEqual({ x: 10 + INSET, z: 9 });
    expect(clampInside(room, { x: 13, z: 11.95 })).toEqual({ x: 13, z: 12 - INSET });
  });

  it('точку за пределами комнаты втягивает внутрь', () => {
    expect(clampInside(room, { x: 0, z: 0 })).toEqual({ x: 10 + INSET, z: 4 + INSET });
  });
});
