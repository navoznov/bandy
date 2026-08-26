import { describe, it, expect } from 'vitest';
import { inventoryItems, heldItem, itemsInRoom, setHeld, type Locations } from './inventory';

function locations(): Locations {
  return new Map([
    ['key_brass', { kind: 'inventory' }],
    ['rock', { kind: 'world', room: 'a', at: [1, 0.9, 1] }],
    ['ash', { kind: 'gone' }],
  ]);
}

describe('inventory', () => {
  it('в инвентаре только предметы с расположением inventory', () => {
    expect(inventoryItems(locations())).toEqual(['key_brass']);
  });

  it('в руках пусто, пока ничего не взято', () => {
    expect(heldItem(locations())).toBeNull();
  });

  it('в комнате видны только лежащие в ней предметы', () => {
    expect(itemsInRoom(locations(), 'a')).toEqual(['rock']);
    expect(itemsInRoom(locations(), 'b')).toEqual([]);
  });

  it('взятие в руки убирает предмет из инвентаря', () => {
    const loc = locations();
    setHeld(loc, 'key_brass');
    expect(heldItem(loc)).toBe('key_brass');
    expect(inventoryItems(loc)).toEqual([]);
  });

  it('взятие другого предмета возвращает прежний в инвентарь', () => {
    const loc = locations();
    loc.set('rock', { kind: 'inventory' });
    setHeld(loc, 'key_brass');
    setHeld(loc, 'rock');
    expect(heldItem(loc)).toBe('rock');
    expect(inventoryItems(loc)).toEqual(['key_brass']);
  });

  it('снятие с руки возвращает предмет в инвентарь', () => {
    const loc = locations();
    setHeld(loc, 'key_brass');
    setHeld(loc, null);
    expect(heldItem(loc)).toBeNull();
    expect(inventoryItems(loc)).toEqual(['key_brass']);
  });

  it('предмет не может оказаться в двух местах сразу', () => {
    const loc = locations();
    setHeld(loc, 'key_brass');
    const places = [...loc.values()].filter((l) => l.kind === 'hand');
    expect(places).toHaveLength(1);
  });
});
