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
      { id: 'a', rect: [0, 0, 8, 6], color: '#888888', light: 1 },
      { id: 'b', rect: [8, 2, 6, 2], color: '#888888', light: 1 },
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
