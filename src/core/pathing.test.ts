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
