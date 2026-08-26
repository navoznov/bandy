import { describe, expect, it } from 'vitest';
import rawLevel from './level_03.json';
import rawItems from './items.json';
import { validateLevel } from '../core/validate';
import type { ItemDef } from '../core/types';

const defs = rawItems as unknown as Record<string, ItemDef>;

function load() {
  const result = validateLevel(rawLevel, defs);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.level;
}

describe('level_03', () => {
  it('проходит валидацию', () => {
    const result = validateLevel(rawLevel, defs);
    // Ошибки печатаются целиком: список из валидатора и есть диагноз.
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('в уровне двенадцать комнат, три замка и четыре предмета', () => {
    const level = load();
    expect(level.rooms).toHaveLength(12);
    expect(level.doors.filter((d) => d.lock !== undefined)).toHaveLength(3);
    expect(level.items).toHaveLength(4);
  });

  /**
   * Смысл этого уровня и единственная причина его формы: кольцо коридора вокруг
   * шахты, по которому можно бегать кругами. Замок на любой из четырёх дверей
   * кольца рвёт круг и превращает уровень обратно в дерево — то есть отменяет
   * всё, ради чего он рисовался. Проверка данных, а не поведения: замка не
   * должно быть даже временно.
   */
  it('ни одна дверь кольца не заперта', () => {
    const level = load();
    const ring = level.doors.filter((d) => d.id.startsWith('d_ring_'));
    expect(ring).toHaveLength(4);
    expect(ring.filter((d) => d.lock !== undefined)).toEqual([]);
  });

  /**
   * Кольцо замкнуто: из каждого отрезка коридора есть дверь в следующий, и обход
   * возвращает в исходный. Дверь, поставленная не между теми комнатами (опечатка
   * в `between`), оставит четыре отрезка в виде змейки — глазами это заметно
   * только при обходе, а тут падает сразу.
   */
  it('четыре отрезка коридора образуют замкнутый круг', () => {
    const level = load();
    const ring = ['hall_s', 'hall_e', 'hall_n', 'hall_w'];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const door = level.doors.find(
        (d) => d.between.includes(a) && d.between.includes(b),
      );
      expect(door, `нет двери между "${a}" и "${b}"`).toBeDefined();
    }
  });

  /**
   * Та же ловушка, что и на втором уровне, но с другим ключом: положить ключ за
   * ту самую дверь, которую он открывает. На кольцевом уровне ошибиться проще —
   * обход создаёт ощущение, что «всё равно как-нибудь дойду».
   */
  it('медный ключ, положенный за собственную дверь, делает уровень непроходимым', () => {
    const broken = structuredClone(rawLevel);
    const copper = broken.items.find((it) => it.def === 'key_copper');
    if (!copper) throw new Error('В уровне нет key_copper — тест устарел вместе с картой.');
    copper.room = 'kitchen';
    copper.at = [13, 0.02, 2.5];

    const result = validateLevel(broken, defs);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Ключ "Медный ключ" нужен для замка "lock_copper", но лежит в комнате "kitchen", '
        + 'куда нельзя попасть, не открыв этот замок.',
      );
      expect(result.errors).toContain(
        'Уровень непроходим: победа недостижима из точки появления.',
      );
    }
  });
});
