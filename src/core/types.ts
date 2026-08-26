export type Rect = readonly [x: number, z: number, w: number, d: number];

export interface ItemDef {
  id: string;
  name: string;
  /** Можно ли взять предмет в руки из инвентаря. */
  holdable: boolean;
}

export interface RoomDef {
  id: string;
  rect: Rect;
  color: string;
  /** Яркость освещения комнаты, 0..1. Позже станет множителем для полумрака. */
  light: number;
}

export interface DoorDef {
  id: string;
  between: readonly [string, string];
  at: readonly [number, number];
  /** Идентификатор замка. Дверь заперта, пока объект замка существует. */
  lock?: string;
  /** Текст таблички над дверью. */
  sign?: string;
}

export interface ItemPlacement {
  def: string;
  room: string;
  at: readonly [number, number, number];
}

export interface TriggerDef {
  id: string;
  room: string;
  rect: Rect;
  effect: 'win';
}

export type Effect =
  | { kind: 'take'; item: string }
  | { kind: 'consume'; item: string }
  | { kind: 'destroy'; object: string }
  | { kind: 'setFlag'; flag: string }
  | { kind: 'toggleDoor'; door: string }
  | { kind: 'say'; text: string }
  | { kind: 'win' };

export interface InteractionRule {
  use: string;
  on: string;
  effects: Effect[];
}

export interface Spawn {
  room: string;
  x: number;
  z: number;
  yaw: number;
}

export interface Level {
  id: string;
  spawn: Spawn;
  rooms: RoomDef[];
  doors: DoorDef[];
  items: ItemPlacement[];
  triggers: TriggerDef[];
  interactions: InteractionRule[];
  itemDefs: Record<string, ItemDef>;
}

export type ItemLocation =
  | { kind: 'world'; room: string; at: readonly [number, number, number] }
  | { kind: 'inventory' }
  | { kind: 'hand' }
  | { kind: 'gone' };
