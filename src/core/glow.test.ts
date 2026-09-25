import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { exitGlow } from './glow';
import type { Level } from './types';

function level(id: string): Level {
  const loaded = loadLevel(id);
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  return loaded.level;
}

describe('засветка на подходе к выходу', () => {
  it('не проходит сквозь стену: угол холодильной второго уровня', () => {
    // Угол `cold` у стены коридора выхода: до центра триггера 3.8 м по прямой,
    // но ногами — через весь подвал и дверь EXIT.
    expect(exitGlow(level('level_02'), { x: 17.6, z: 19.6 })).toBe(0);
  });

  for (const id of ['level_01', 'level_02', 'level_03']) {
    it(`${id}: у двери коридора темно, у триггера светло`, () => {
      const lv = level(id);
      const hall = lv.rooms.find((r) => r.id === 'exit_hall')!;
      const door = lv.doors.find((d) => d.between.includes('exit_hall'))!;
      const win = lv.triggers.find((t) => t.effect === 'win')!;
      const [hx, , hw] = hall.rect;
      const [, tz, , td] = win.rect;

      expect(exitGlow(lv, { x: door.at[0], z: door.at[1] + 0.5 })).toBe(0);
      expect(exitGlow(lv, { x: hx + hw / 2, z: tz + td / 2 })).toBe(0.9);
    });
  }
});
