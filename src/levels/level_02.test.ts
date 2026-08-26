import { describe, expect, it } from 'vitest';
import rawLevel from './level_02.json';
import rawItems from './items.json';
import { validateLevel } from '../core/validate';
import type { ItemDef } from '../core/types';

const defs = rawItems as unknown as Record<string, ItemDef>;

describe('level_02', () => {
  it('проходит валидацию', () => {
    const result = validateLevel(rawLevel, defs);
    // Ошибки печатаются целиком: список из валидатора и есть диагноз.
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('в уровне десять комнат, два замка и три предмета', () => {
    const result = validateLevel(rawLevel, defs);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.level.rooms).toHaveLength(10);
    expect(result.level.doors.filter((d) => d.lock !== undefined)).toHaveLength(2);
    expect(result.level.items).toHaveLength(3);
  });

  /**
   * Главная проверка данных этого уровня. Цепочка «ключ за дверью, которую он же
   * открывает» — единственная ошибка автора карты, которую невозможно заметить
   * глазами в редакторе и очень легко сделать. До сих пор проверка достижимости
   * нагружалась только синтетическими уровнями из validate.test.ts.
   */
  it('железный ключ, положенный за собственную решётку, делает уровень непроходимым', () => {
    const broken = structuredClone(rawLevel);
    const iron = broken.items.find((it) => it.def === 'key_iron');
    if (!iron) throw new Error('В уровне нет key_iron — тест устарел вместе с картой.');
    iron.room = 'elec';
    iron.at = [9, 0.02, 4];

    const result = validateLevel(broken, defs);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Валидатор выдаёт здесь две ошибки, и требовать надо точную: она называет
      // ключ, замок и комнату, то есть чинится по ней без раздумий. Общая
      // «уровень непроходим» — следствие, и одной её мало.
      expect(result.errors).toContain(
        'Ключ "Железный ключ" нужен для замка "lock_grate", но лежит в комнате "elec", '
        + 'куда нельзя попасть, не открыв этот замок.',
      );
      expect(result.errors).toContain(
        'Уровень непроходим: победа недостижима из точки появления.',
      );
    }
  });
});
