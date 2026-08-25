import { describe, it, expect } from 'vitest';
import { doorOnVerticalWall, validateLevel } from './validate';
import type { DoorDef, ItemDef, RoomDef } from './types';

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
    const errors = errorsFor((l) => { (l.doors[0]! as Record<string, unknown>).lock = 'lock_x'; });
    expect(errors.join(' ')).toContain('lock_x');
  });

  it('ловит спавн вне своей комнаты', () => {
    const errors = errorsFor((l) => { l.spawn.x = 99; });
    expect(errors.join(' ')).toContain('появления');
  });

  it('ловит триггер вне своей комнаты', () => {
    const errors = errorsFor((l) => {
      l.triggers.push({ id: 'win', room: 'a', rect: [50, 50, 2, 2], effect: 'win' } as never);
    });
    expect(errors.join(' ')).toContain('win');
  });

  it('разбирает сокращённую запись эффектов в размеченное объединение', () => {
    const lvl = baseLevel();
    (lvl.doors[0]! as Record<string, unknown>).lock = 'lock_x';
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
