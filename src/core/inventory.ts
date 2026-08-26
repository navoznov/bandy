import type { ItemLocation } from './types';

export type Locations = Map<string, ItemLocation>;

export function inventoryItems(locations: Locations): string[] {
  const result: string[] = [];
  for (const [id, loc] of locations) {
    if (loc.kind === 'inventory') result.push(id);
  }
  return result;
}

export function heldItem(locations: Locations): string | null {
  for (const [id, loc] of locations) {
    if (loc.kind === 'hand') return id;
  }
  return null;
}

export function itemsInRoom(locations: Locations, room: string): string[] {
  const result: string[] = [];
  for (const [id, loc] of locations) {
    if (loc.kind === 'world' && loc.room === room) result.push(id);
  }
  return result;
}

/**
 * Переводит предмет в руку. Предыдущий возвращается в инвентарь.
 * Передача `null` просто освобождает руки.
 */
export function setHeld(locations: Locations, item: string | null): void {
  const previous = heldItem(locations);
  if (previous !== null) locations.set(previous, { kind: 'inventory' });
  if (item !== null) locations.set(item, { kind: 'hand' });
}
