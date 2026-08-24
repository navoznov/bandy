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
