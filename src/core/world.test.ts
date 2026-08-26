import { describe, it, expect } from 'vitest';
import { World, type WorldEvent } from './world';
import { makeTestLevel } from './test-fixtures';

function world() {
  const w = new World(makeTestLevel());
  const events: WorldEvent[] = [];
  w.on((e) => events.push(e));
  return { w, events };
}

describe('World', () => {
  it('раскладывает предметы по комнатам при создании', () => {
    const { w } = world();
    expect(w.locationOf('key_brass')).toEqual({ kind: 'world', room: 'a', at: [2, 0.9, 4] });
  });

  it('take переносит предмет в инвентарь и сообщает об этом', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'take', item: 'key_brass' }]);
    expect(w.inventory()).toContain('key_brass');
    expect(events).toContainEqual({ kind: 'itemTaken', item: 'key_brass' });
  });

  it('consume убирает предмет насовсем', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'take', item: 'key_brass' }]);
    w.setHeld('key_brass');
    w.applyEffects([{ kind: 'consume', item: 'key_brass' }]);
    expect(w.held()).toBeNull();
    expect(w.inventory()).toEqual([]);
    expect(events).toContainEqual({ kind: 'itemGone', item: 'key_brass' });
    // Одного состояния мало. Предмет в руке рисуется по подписке на handChanged,
    // и без события меш остаётся висеть: ключ пропал из рюкзака, а в руке есть.
    expect(events).toContainEqual({ kind: 'handChanged', item: null });
  });

  it('consume предмета не из руки руку не трогает', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'take', item: 'key_brass' }]);
    w.applyEffects([{ kind: 'consume', item: 'key_brass' }]);
    expect(events.filter((e) => e.kind === 'handChanged')).toEqual([]);
  });

  it('destroy помечает объект уничтоженным', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'destroy', object: 'lock_ab' }]);
    expect(w.isDestroyed('lock_ab')).toBe(true);
    expect(events).toContainEqual({ kind: 'objectDestroyed', object: 'lock_ab' });
  });

  it('toggleDoor открывает и закрывает дверь', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'toggleDoor', door: 'd_ab' }]);
    expect(w.isDoorOpen('d_ab')).toBe(true);
    w.applyEffects([{ kind: 'toggleDoor', door: 'd_ab' }]);
    expect(w.isDoorOpen('d_ab')).toBe(false);
    expect(events).toContainEqual({ kind: 'doorOpened', door: 'd_ab' });
    expect(events).toContainEqual({ kind: 'doorClosed', door: 'd_ab' });
  });

  it('say и setFlag работают', () => {
    const { w, events } = world();
    w.applyEffects([{ kind: 'say', text: 'Щёлк.' }, { kind: 'setFlag', flag: 'power' }]);
    expect(w.hasFlag('power')).toBe(true);
    expect(events).toContainEqual({ kind: 'said', text: 'Щёлк.' });
  });

  it('вход в триггер приводит к победе', () => {
    const { w, events } = world();
    w.checkTriggers(13, 3);
    expect(w.won).toBe(true);
    expect(events).toContainEqual({ kind: 'won' });
  });

  it('вне триггера победы не происходит', () => {
    const { w } = world();
    w.checkTriggers(2, 3);
    expect(w.won).toBe(false);
  });

  it('победа срабатывает один раз', () => {
    const { w, events } = world();
    w.checkTriggers(13, 3);
    w.checkTriggers(13, 3);
    expect(events.filter((e) => e.kind === 'won')).toHaveLength(1);
  });

  it('openDoors отдаёт множество для отбора коллайдеров', () => {
    const { w } = world();
    w.applyEffects([{ kind: 'toggleDoor', door: 'd_ab' }]);
    expect([...w.openDoors()]).toEqual(['d_ab']);
  });
});
