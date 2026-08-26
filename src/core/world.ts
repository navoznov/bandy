import { heldItem, inventoryItems, itemsInRoom, setHeld, type Locations } from './inventory';
import { resolveInteraction, type Outcome, type WorldView } from './interactions';
import type { Effect, ItemLocation, Level } from './types';

export type WorldEvent =
  | { kind: 'itemTaken'; item: string }
  | { kind: 'itemGone'; item: string }
  | { kind: 'objectDestroyed'; object: string }
  | { kind: 'doorOpened'; door: string }
  | { kind: 'doorClosed'; door: string }
  | { kind: 'handChanged'; item: string | null }
  | { kind: 'said'; text: string }
  | { kind: 'won' };

export class World implements WorldView {
  private readonly locations: Locations = new Map();
  private readonly destroyedIds = new Set<string>();
  private readonly openDoorIds = new Set<string>();
  private readonly flags = new Set<string>();
  /** Цели, на которые игрок уже нажимал. Это знание игрока, а не правило игры. */
  private readonly triedIds = new Set<string>();
  private readonly listeners: Array<(event: WorldEvent) => void> = [];

  won = false;

  constructor(readonly level: Level) {
    for (const placement of level.items) {
      this.locations.set(placement.def, {
        kind: 'world',
        room: placement.room,
        at: placement.at,
      });
    }
  }

  on(listener: (event: WorldEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: WorldEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  held(): string | null { return heldItem(this.locations); }
  inventory(): string[] { return inventoryItems(this.locations); }
  itemsOnFloor(room: string): string[] { return itemsInRoom(this.locations, room); }
  locationOf(item: string): ItemLocation | undefined { return this.locations.get(item); }
  isDestroyed(id: string): boolean { return this.destroyedIds.has(id); }
  isDoorOpen(id: string): boolean { return this.openDoorIds.has(id); }
  hasFlag(flag: string): boolean { return this.flags.has(flag); }
  openDoors(): ReadonlySet<string> { return this.openDoorIds; }

  setHeld(item: string | null): void {
    setHeld(this.locations, item);
    this.emit({ kind: 'handChanged', item });
  }

  /** Что произойдёт, если сейчас нажать «взаимодействовать». Состояние не меняется. */
  describe(targetId: string): Outcome {
    const outcome = resolveInteraction(this, targetId);
    // Решение то же самое; меняется только то, что игроку позволено о нём знать.
    // Поле убирается, а не подменяется: `main.ts` ветвится по его наличию.
    if (!outcome.ok && this.triedIds.has(targetId)) {
      return { ok: false, refusal: outcome.refusal };
    }
    return outcome;
  }

  /** То же решение, но применённое. */
  interact(targetId: string): Outcome {
    const outcome = resolveInteraction(this, targetId);
    this.triedIds.add(targetId);
    if (outcome.ok) this.applyEffects(outcome.effects);
    return outcome;
  }

  applyEffects(effects: readonly Effect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'take':
          this.locations.set(effect.item, { kind: 'inventory' });
          this.emit({ kind: 'itemTaken', item: effect.item });
          break;
        case 'consume': {
          // Израсходованный предмет исчезает отовсюду, включая руку. Состояние
          // это уже отражает — `held()` вернёт null, — но предмет в руке рисуется
          // по подписке на `handChanged`, и без события меш остался бы висеть:
          // ключ пропал из рюкзака, а в руке всё ещё есть.
          const wasHeld = this.locations.get(effect.item)?.kind === 'hand';
          this.locations.set(effect.item, { kind: 'gone' });
          this.emit({ kind: 'itemGone', item: effect.item });
          if (wasHeld) this.emit({ kind: 'handChanged', item: null });
          break;
        }
        case 'destroy':
          this.destroyedIds.add(effect.object);
          this.emit({ kind: 'objectDestroyed', object: effect.object });
          break;
        case 'toggleDoor':
          if (this.openDoorIds.delete(effect.door)) {
            this.emit({ kind: 'doorClosed', door: effect.door });
          } else {
            this.openDoorIds.add(effect.door);
            this.emit({ kind: 'doorOpened', door: effect.door });
          }
          break;
        case 'setFlag':
          this.flags.add(effect.flag);
          break;
        case 'say':
          this.emit({ kind: 'said', text: effect.text });
          break;
        case 'win':
          this.won = true;
          this.emit({ kind: 'won' });
          break;
      }
    }
  }

  /** Вызывается каждый кадр с текущей позицией игрока. */
  checkTriggers(x: number, z: number): void {
    if (this.won) return;
    for (const trigger of this.level.triggers) {
      const [tx, tz, tw, td] = trigger.rect;
      if (x >= tx && x <= tx + tw && z >= tz && z <= tz + td) {
        this.applyEffects([{ kind: 'win' }]);
        return;
      }
    }
  }
}
