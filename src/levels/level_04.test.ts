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
