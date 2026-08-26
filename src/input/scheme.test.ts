import { describe, it, expect } from 'vitest';
import { nextScheme } from './index';

/**
 * Проверяется только правило выбора схемы. Проводку обработчиков (какие именно
 * события подписаны) без браузера проверить нечем: в тестовой среде нет ни
 * `window`, ни pointer-событий, а jsdom в проект не тянем.
 */
describe('выбор схемы ввода', () => {
  it('касание включает тач', () => {
    expect(nextScheme('desktop', { kind: 'pointer', pointerType: 'touch' })).toBe('touch');
  });

  it('клавиша возвращает десктоп — защёлки в одну сторону нет', () => {
    expect(nextScheme('touch', { kind: 'key' })).toBe('desktop');
  });

  it('настоящая мышь возвращает десктоп', () => {
    expect(nextScheme('touch', { kind: 'pointer', pointerType: 'mouse' })).toBe('desktop');
  });

  it('переключается туда и обратно сколько угодно раз', () => {
    let scheme = nextScheme('desktop', { kind: 'pointer', pointerType: 'touch' });
    scheme = nextScheme(scheme, { kind: 'key' });
    expect(scheme).toBe('desktop');
    scheme = nextScheme(scheme, { kind: 'pointer', pointerType: 'touch' });
    expect(scheme).toBe('touch');
    scheme = nextScheme(scheme, { kind: 'pointer', pointerType: 'mouse' });
    expect(scheme).toBe('desktop');
  });

  it('перо и незнакомый указатель схему не трогают', () => {
    expect(nextScheme('touch', { kind: 'pointer', pointerType: 'pen' })).toBe('touch');
    expect(nextScheme('desktop', { kind: 'pointer', pointerType: '' })).toBe('desktop');
  });
});
