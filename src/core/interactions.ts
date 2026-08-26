import type { DoorDef, Effect, ItemLocation, Level } from './types';

export type Outcome =
  | { ok: true; prompt: string; effects: Effect[] }
  /**
   * `untried` — что показывать, пока игрок ни разу не нажал на эту цель (спека §6,
   * уточнение от 26 августа 2026). Заводится только там, где скрытая причина
   * создаёт интригу: увидеть «Заперто» с другого конца коридора значит получить
   * загадку, не подойдя к ней. Само разрешение о попытках не знает — что игрок уже
   * пробовал, помнит `World`, он же это поле и убирает.
   */
  | { ok: false; refusal: string; untried?: string };

/** Ровно то, что разрешению нужно от мира. Позволяет обойтись без циклического импорта. */
export interface WorldView {
  readonly level: Level;
  held(): string | null;
  locationOf(item: string): ItemLocation | undefined;
  isDestroyed(id: string): boolean;
  isDoorOpen(id: string): boolean;
}

type Target =
  | { kind: 'item'; id: string }
  | { kind: 'lock'; id: string }
  | { kind: 'door'; door: DoorDef };

function classify(view: WorldView, targetId: string): Target | null {
  if (view.level.itemDefs[targetId]) {
    const location = view.locationOf(targetId);
    return location?.kind === 'world' ? { kind: 'item', id: targetId } : null;
  }

  const lockedDoor = view.level.doors.find((d) => d.lock === targetId);
  if (lockedDoor) {
    return view.isDestroyed(targetId) ? null : { kind: 'lock', id: targetId };
  }

  const door = view.level.doors.find((d) => d.id === targetId);
  if (door) return { kind: 'door', door };

  return null;
}

function nameOf(view: WorldView, itemId: string): string {
  return view.level.itemDefs[itemId]?.name ?? itemId;
}

/**
 * Единственная точка принятия решения о взаимодействии.
 * Вызывается и для подсказки, и для действия — поэтому подсказка не может соврать.
 */
export function resolveInteraction(view: WorldView, targetId: string): Outcome {
  const target = classify(view, targetId);
  if (!target) return { ok: false, refusal: 'Здесь не с чем взаимодействовать.' };

  const held = view.held();

  if (held !== null) {
    const rule = view.level.interactions.find((r) => r.use === held && r.on === targetId);
    if (rule) {
      return { ok: true, prompt: `Использовать: ${nameOf(view, held)}`, effects: rule.effects };
    }
  }

  switch (target.kind) {
    case 'item':
      return {
        ok: true,
        prompt: `Подобрать: ${nameOf(view, target.id)}`,
        effects: [{ kind: 'take', item: target.id }],
      };

    case 'lock': {
      // Название идёт первым в обоих отказах: держа неподходящий предмет, игрок
      // иначе вообще не узнал бы, что за замок перед ним. Запасной текст на случай
      // безымянного замка — прежний; валидатор такого уровня не пропустит, но
      // `noUncheckedIndexedAccess` требует ветку, и врать в ней незачем.
      const lock = view.level.locks[target.id] ?? 'Замок заперт';
      return held === null
        ? { ok: false, refusal: `${lock}. Нужно чем-то открыть.` }
        : { ok: false, refusal: `${lock}. ${nameOf(view, held)} не подходит.` };
    }

    case 'door': {
      const { door } = target;
      if (door.lock !== undefined && !view.isDestroyed(door.lock)) {
        // Запертая дверь никогда не открыта, поэтому текст до попытки всегда этот.
        return { ok: false, refusal: 'Заперто. На двери висит замок.', untried: 'Открыть дверь' };
      }
      return {
        ok: true,
        prompt: view.isDoorOpen(door.id) ? 'Закрыть дверь' : 'Открыть дверь',
        effects: [{ kind: 'toggleDoor', door: door.id }],
      };
    }
  }
}
