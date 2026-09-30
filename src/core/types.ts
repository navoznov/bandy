export type Rect = readonly [x: number, z: number, w: number, d: number];

export interface ItemDef {
  id: string;
  name: string;
  /** Можно ли взять предмет в руки из инвентаря. */
  holdable: boolean;
}

/**
 * Тема комнаты. Задаёт оформление всех её поверхностей разом; что именно
 * нарисовать для каждой темы, решает рендер (`render/wallpaper.ts`).
 */
export const ROOM_STYLES = [
  'living', 'bedroom', 'nursery', 'hall', 'study',
  'kitchen', 'bath', 'laundry', 'storage', 'plain',
] as const;

export type RoomStyle = typeof ROOM_STYLES[number];

export interface RoomDef {
  id: string;
  rect: Rect;
  color: string;
  /** Яркость освещения комнаты, 0..1. Позже станет множителем для полумрака. */
  light: number;
  /** Без темы комната остаётся с нейтральными серыми стенами. */
  style?: RoomStyle;
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

export interface AntagonistDef {
  /** Где он стоит в нулевую секунду. Как spawn игрока, минус yaw: он смотрит туда, куда идёт. */
  spawn: { room: string; x: number; z: number };
  /**
   * Комнаты, которые он обходит по кругу. Список ЦЕЛЕЙ, а не пошаговый путь:
   * дорогу между ними он ищет сам. Недостижимая сейчас комната из обхода
   * временно выпадает — так запертая комната становится убежищем.
   */
  route: string[];
  /** Двери, которые он никогда не закрывает за собой. Без них кольцо стояло бы закрытым. */
  keepOpen: string[];
}

/** Проёмы офиса, которые игрок закрывает. Порядок — порядок кнопок слева направо. */
export const SHUTTER_SIDES = ['left', 'vent', 'right'] as const;
export type ShutterSide = typeof SHUTTER_SIDES[number];

/** Точка маршрута ночного монстра. Комната названа явно: опечатку в ней валидатор ловит по имени. */
export interface RoutePoint {
  room: string;
  at: readonly [number, number];
}

export interface NightCamera {
  /** Номер на карте монитора, как на рисунке: "1".."9". */
  id: string;
  room: string;
  /** Где висит под потолком. */
  at: readonly [number, number];
  /** Куда смотрит объектив — точка на полу. */
  look: readonly [number, number];
}

export interface NightMonster {
  id: string;
  color: string;
  /** 0..20. Шанс прыжка на каждом броске — aggression / 20, как в оригинале. */
  aggression: number;
  /** У какой заслонки кончается маршрут. */
  door: ShutterSide;
  /** Первая точка — старт, последняя — у заслонки. После заслонки — снова первая. */
  route: RoutePoint[];
}

export interface NightDef {
  office: string;
  shutters: Record<ShutterSide, string>;
  /** Низкий помост сцены. Монстр, чья точка внутри, стоит на нём. */
  stage?: Rect;
  cameras: NightCamera[];
  /** Первый в списке приходит, когда кончилась энергия. */
  monsters: NightMonster[];
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
  /**
   * Название замка, как его видит игрок: «идентификатор из `door.lock`» → строка.
   * Единственное собственное свойство замка, поэтому отображение плоское, а не
   * запись с полями. Замок описывает себя, но не называет нужный ключ (спека §5).
   */
  locks: Record<string, string>;
  antagonist?: AntagonistDef;
  /** Уровень в ночном режиме: игрок сидит в офисе. Несовместим с `antagonist`. */
  night?: NightDef;
}

export type ItemLocation =
  | { kind: 'world'; room: string; at: readonly [number, number, number] }
  | { kind: 'inventory' }
  | { kind: 'hand' }
  | { kind: 'gone' };
