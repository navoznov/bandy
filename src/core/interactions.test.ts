import { describe, it, expect } from 'vitest';
import { World } from './world';
import { makeTestLevel } from './test-fixtures';

function armed(held: string | null): World {
  const w = new World(makeTestLevel());
  if (held) {
    w.applyEffects([{ kind: 'take', item: held }]);
    w.setHeld(held);
  }
  return w;
}

describe('resolveInteraction', () => {
  it('предлагает подобрать лежащий предмет', () => {
    const outcome = armed(null).describe('key_brass');
    expect(outcome).toEqual({
      ok: true,
      prompt: 'Подобрать: Латунный ключ',
      effects: [{ kind: 'take', item: 'key_brass' }],
    });
  });

  it('подобранный предмет перестаёт быть целью', () => {
    const w = armed(null);
    w.interact('key_brass');
    expect(w.describe('key_brass').ok).toBe(false);
  });

  it('отказывает открыть дверь, пока цел замок', () => {
    const outcome = armed(null).describe('d_ab');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal).toContain('замок');
  });

  it('без предмета в руках замок открыть нечем', () => {
    const outcome = armed(null).describe('lock_ab');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal).toContain('Нужно чем-то открыть');
  });

  it('неподходящий предмет получает внятный отказ', () => {
    const outcome = armed('rock').describe('lock_ab');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal).toContain('Камень');
  });

  it('правило из реестра срабатывает на подходящий предмет', () => {
    const w = armed('key_brass');
    const outcome = w.interact('lock_ab');
    expect(outcome.ok).toBe(true);
    expect(w.isDestroyed('lock_ab')).toBe(true);
    expect(w.held()).toBeNull();
  });

  it('после снятия замка дверь открывается', () => {
    const w = armed('key_brass');
    w.interact('lock_ab');
    const outcome = w.interact('d_ab');
    expect(outcome.ok).toBe(true);
    expect(w.isDoorOpen('d_ab')).toBe(true);
  });

  it('открытая дверь предлагает закрыться', () => {
    const w = armed('key_brass');
    w.interact('lock_ab');
    w.interact('d_ab');
    const outcome = w.describe('d_ab');
    expect(outcome.ok && outcome.prompt).toBe('Закрыть дверь');
  });

  it('неизвестная цель даёт отказ, а не исключение', () => {
    expect(armed(null).describe('ничего').ok).toBe(false);
  });

  it('отказ не меняет состояние мира', () => {
    const w = armed('rock');
    w.interact('lock_ab');
    expect(w.isDestroyed('lock_ab')).toBe(false);
    expect(w.held()).toBe('rock');
  });

  it('сценарий целиком: ключ, замок, дверь, выход', () => {
    const w = new World(makeTestLevel());
    expect(w.interact('key_brass').ok).toBe(true);
    w.setHeld('key_brass');
    expect(w.interact('lock_ab').ok).toBe(true);
    expect(w.interact('d_ab').ok).toBe(true);
    w.checkTriggers(13, 3);
    expect(w.won).toBe(true);
  });

  it('describe и interact никогда не расходятся', () => {
    const targets = ['key_brass', 'rock', 'd_ab', 'lock_ab', 'ничего'];
    const hands = [null, 'key_brass', 'rock'];

    for (const held of hands) {
      for (const target of targets) {
        const described = armed(held).describe(target);
        const applied = armed(held).interact(target);

        expect(applied.ok).toBe(described.ok);
        if (described.ok && applied.ok) {
          expect(applied.prompt).toBe(described.prompt);
          expect(applied.effects).toEqual(described.effects);
        } else if (!described.ok && !applied.ok) {
          expect(applied.refusal).toBe(described.refusal);
        }
      }
    }
  });

  it('describe не меняет состояние мира', () => {
    const w = armed('key_brass');
    w.describe('lock_ab');
    expect(w.isDestroyed('lock_ab')).toBe(false);
    expect(w.held()).toBe('key_brass');
  });
});
