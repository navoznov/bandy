import { describe, it, expect } from 'vitest';
import { doorOnVerticalWall, validateLevel } from './validate';
import { loadLevel } from '../levels';
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
    triggers: [{ id: 'base_win', room: 'b', rect: [12, 2, 1, 1], effect: 'win' }],
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
    lvl.rooms.push({ id: 'c', rect: [0, 6, 4, 4], color: '#888888', light: 1 });
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

describe('validateLevel: достижимость (I2)', () => {
  it('ловит уровень, где ключ лежит за той самой дверью, которую он открывает', () => {
    const errors = errorsFor((l) => {
      (l.doors[0]! as Record<string, unknown>).lock = 'lock_ab';
      l.items[0]!.room = 'b'; // ключ теперь ЗА запертой дверью d_ab
      l.interactions.push({
        use: 'key_brass',
        on: 'lock_ab',
        effects: [{ destroy: 'lock_ab' }, { consume: 'key_brass' }],
      } as never);
    });
    const text = errors.join(' ');
    expect(text).toContain('нельзя попасть, не открыв этот замок');
    expect(text).toContain('lock_ab');
    expect(text).toContain('"b"');
  });

  it('ловит уровень без пути к победе общим сообщением, когда специфичная причина не подходит', () => {
    const errors = errorsFor((l) => { l.triggers = []; });
    expect(errors.join(' ')).toContain('непроходим');
  });

  it('принимает уровень с ключом на стороне спавна и замком дальше по пути', () => {
    const lvl = baseLevel();
    (lvl.doors[0]! as Record<string, unknown>).lock = 'lock_ab';
    lvl.interactions.push({
      use: 'key_brass',
      on: 'lock_ab',
      effects: [{ destroy: 'lock_ab' }, { consume: 'key_brass' }],
    } as never);
    expect(validateLevel(lvl, itemDefs).ok).toBe(true);
  });

  it('принимает настоящий уровень src/levels/level_01.json', () => {
    const result = loadLevel();
    expect(result.ok).toBe(true);
  });
});

describe('validateLevel: ширина проёма в стыке (I3)', () => {
  it('ловит дверь у самого угла стыка, куда не помещается проём', () => {
    const errors = errorsFor((l) => { l.doors[0]!.at = [8, 2]; }); // стык z 2..4, дверь ровно в углу
    const text = errors.join(' ');
    expect(text).toContain('d_ab');
    expect(text).toContain('не помещается');
  });

  it('принимает дверь, отстоящую от углов стыка не меньше чем на половину ширины проёма', () => {
    // стык a/b по z: [2, 4], половина ширины проёма 0.45 => допустимо [2.45, 3.55]
    const errors = errorsFor((l) => { l.doors[0]!.at = [8, 2.45]; });
    expect(errors).toEqual([]);
  });
});

describe('validateLevel: уникальность идентификаторов (M9)', () => {
  it('ловит совпадение id двери с id предмета из реестра', () => {
    const errors = errorsFor((l) => { l.doors[0]!.id = 'key_brass'; });
    const text = errors.join(' ');
    expect(text).toContain('key_brass');
    expect(text).toContain('использован дважды');
  });

  it('ловит совпадение id замка с id триггера', () => {
    const errors = errorsFor((l) => {
      (l.doors[0]! as Record<string, unknown>).lock = 'base_win';
      l.interactions.push({
        use: 'key_brass',
        on: 'base_win',
        effects: [{ destroy: 'base_win' }],
      } as never);
    });
    const text = errors.join(' ');
    expect(text).toContain('base_win');
    expect(text).toContain('использован дважды');
  });
});

describe('validateLevel: структурная проверка формы JSON (M10)', () => {
  it('ловит мусор в поле color, не подменяя его сообщением про другое поле', () => {
    const errors = errorsFor((l) => { l.rooms[0]!.color = 'не цвет'; });
    expect(errors.join(' ')).toContain('"color"');
  });

  it('битая форма не тянет за собой ложные ошибки про несуществующие комнаты', () => {
    // Комната с битым полем отбрасывается разбором, и всё, что на неё ссылалось,
    // без отсечки сообщало бы «несуществующая комната» — три лжи поверх правды.
    const errors = errorsFor((l) => { l.rooms[0]!.color = 'не цвет'; });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"color"');
  });

  it('принимает короткую запись цвета "#rgb"', () => {
    const errors = errorsFor((l) => { l.rooms[0]!.color = '#888'; });
    expect(errors).toEqual([]);
  });

  it('ловит мусор в поле light', () => {
    const errors = errorsFor((l) => {
      (l.rooms[0]! as Record<string, unknown>).light = 'ярко';
    });
    expect(errors.join(' ')).toContain('"light"');
  });

  it('ловит битый rect и называет настоящую причину, а не спавн', () => {
    const errors = errorsFor((l) => { l.rooms[0]!.rect = [0, 0, 8]; });
    const text = errors.join(' ');
    expect(text).toContain('rect');
    expect(text).not.toContain('находится вне комнаты');
  });

  it('ловит неположительную ширину или глубину комнаты', () => {
    const errors = errorsFor((l) => { l.rooms[0]!.rect = [0, 0, -8, -6]; });
    expect(errors.join(' ')).toContain('положительными');
  });

  it('ловит поле "at" двери неправильной формы', () => {
    const errors = errorsFor((l) => { (l.doors[0]! as Record<string, unknown>).at = [8]; });
    expect(errors.join(' ')).toContain('"at"');
  });

  it('ловит поле "at" предмета неправильной формы', () => {
    const errors = errorsFor((l) => { l.items[0]!.at = [2, 4]; });
    expect(errors.join(' ')).toContain('"at"');
  });

  it('ловит нестроковый id комнаты', () => {
    const errors = errorsFor((l) => {
      (l.rooms[0]! as Record<string, unknown>).id = 42;
    });
    expect(errors.join(' ')).toContain('"id"');
  });

  it('ловит поле "rooms", которое не является массивом', () => {
    const lvl = baseLevel() as unknown as Record<string, unknown>;
    lvl['rooms'] = 'не массив';
    const result = validateLevel(lvl, itemDefs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toContain('"rooms"');
  });
});
