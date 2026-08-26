import { DOOR } from '../config';
import type {
  DoorDef, Effect, InteractionRule, ItemDef, ItemPlacement,
  Level, Rect, RoomDef, TriggerDef,
} from './types';

export function roomBounds(room: RoomDef) {
  const [x, z, w, d] = room.rect;
  return { x0: x, x1: x + w, z0: z, z1: z + d };
}

function contains(room: RoomDef, x: number, z: number): boolean {
  const b = roomBounds(room);
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
}

const EPS = 1e-9;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// Короткая запись #rgb — законный CSS, и three.js её принимает. Валидатор,
// отвергающий верные данные, хуже мягкого: он блокирует автора карты ни за что.
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Достаёт поле верхнего уровня как массив. Не массив/отсутствует — своя ошибка. */
function asArray(lvl: Record<string, unknown>, key: string, errors: string[]): unknown[] {
  const raw = lvl[key];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(`Поле "${key}" должно быть массивом.`);
    return [];
  }
  return raw;
}

/**
 * Прорезан ли проём в стене, идущей вдоль оси Z (то есть на границе по X).
 *
 * Единственное место, где этот факт вычисляется. От него зависят и коллайдер
 * двери (`core/colliders.ts`), и её полотно с петлёй (`render/doors.ts`).
 */
export function doorOnVerticalWall(door: DoorDef, room: RoomDef): boolean {
  const b = roomBounds(room);
  const [dx] = door.at;
  return Math.abs(dx - b.x0) < EPS || Math.abs(dx - b.x1) < EPS;
}

type SharedWallCheck =
  | { ok: true }
  | { ok: false; reason: 'off-wall' }
  | { ok: false; reason: 'too-narrow'; from: number; to: number }
  | { ok: false; reason: 'seam-short'; length: number };

/**
 * Лежит ли проём двери (точка ± половина ширины) на стене, общей для двух комнат.
 *
 * Сначала определяется координата, В КОТОРОЙ комнаты соприкасаются, и точка двери
 * сверяется именно с ней. Проверять принадлежность точки любой из границ комнаты
 * нельзя: дверь, поставленная на дальнюю внешнюю стену, прошла бы проверку, хотя
 * второй комнаты там нет и близко. Дальше проверяется не только точка, но и то,
 * что вокруг неё есть DOOR.width места: иначе проём режется за пределами стыка,
 * и `subtract()` вырезает дыру наружу карты (I3 финального ревью).
 */
function checkSharedWall(a: RoomDef, b: RoomDef, px: number, pz: number): SharedWallCheck {
  const ba = roomBounds(a);
  const bb = roomBounds(b);
  const half = DOOR.width / 2;

  let sharedX: number | null = null;
  if (Math.abs(ba.x1 - bb.x0) < EPS) sharedX = ba.x1;
  else if (Math.abs(bb.x1 - ba.x0) < EPS) sharedX = ba.x0;

  if (sharedX !== null && Math.abs(px - sharedX) < EPS) {
    const from = Math.max(ba.z0, bb.z0);
    const to = Math.min(ba.z1, bb.z1);
    if (pz < from || pz > to) return { ok: false, reason: 'off-wall' };
    // Стык короче двери — двигать её бесполезно, и «допустимый диапазон» вышел бы
    // вывернутым: from > to. Это другая ошибка, и говорить о ней надо иначе.
    if (to - from < DOOR.width - EPS) {
      return { ok: false, reason: 'seam-short', length: to - from };
    }
    if (pz < from + half || pz > to - half) {
      return { ok: false, reason: 'too-narrow', from: from + half, to: to - half };
    }
    return { ok: true };
  }

  let sharedZ: number | null = null;
  if (Math.abs(ba.z1 - bb.z0) < EPS) sharedZ = ba.z1;
  else if (Math.abs(bb.z1 - ba.z0) < EPS) sharedZ = ba.z0;

  if (sharedZ !== null && Math.abs(pz - sharedZ) < EPS) {
    const from = Math.max(ba.x0, bb.x0);
    const to = Math.min(ba.x1, bb.x1);
    if (px < from || px > to) return { ok: false, reason: 'off-wall' };
    if (to - from < DOOR.width - EPS) {
      return { ok: false, reason: 'seam-short', length: to - from };
    }
    if (px < from + half || px > to - half) {
      return { ok: false, reason: 'too-narrow', from: from + half, to: to - half };
    }
    return { ok: true };
  }

  return { ok: false, reason: 'off-wall' };
}

function overlap(a: RoomDef, b: RoomDef): boolean {
  const ba = roomBounds(a);
  const bb = roomBounds(b);
  return ba.x0 < bb.x1 - EPS && bb.x0 < ba.x1 - EPS
      && ba.z0 < bb.z1 - EPS && bb.z0 < ba.z1 - EPS;
}

/** Сокращённая запись из JSON превращается в размеченное объединение. */
function parseEffect(raw: unknown, errors: string[]): Effect | null {
  if (typeof raw !== 'object' || raw === null) {
    errors.push(`Эффект должен быть объектом, получено: ${JSON.stringify(raw)}`);
    return null;
  }
  const e = raw as Record<string, unknown>;
  if (typeof e['take'] === 'string') return { kind: 'take', item: e['take'] };
  if (typeof e['consume'] === 'string') return { kind: 'consume', item: e['consume'] };
  if (typeof e['destroy'] === 'string') return { kind: 'destroy', object: e['destroy'] };
  if (typeof e['setFlag'] === 'string') return { kind: 'setFlag', flag: e['setFlag'] };
  if (typeof e['toggleDoor'] === 'string') return { kind: 'toggleDoor', door: e['toggleDoor'] };
  if (typeof e['say'] === 'string') return { kind: 'say', text: e['say'] };
  if (e['win'] === true) return { kind: 'win' };
  errors.push(`Неизвестный эффект: ${JSON.stringify(raw)}`);
  return null;
}

// --- M10: структурная проверка формы JSON, до всех проверок смысла. -------

function parseRooms(raw: unknown[], errors: string[]): RoomDef[] {
  const rooms: RoomDef[] = [];
  raw.forEach((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`rooms[${i}] должен быть объектом.`);
      return;
    }
    const r = entry as Record<string, unknown>;
    const label = isNonEmptyString(r['id']) ? `"${r['id']}"` : `#${i}`;
    let valid = true;

    if (!isNonEmptyString(r['id'])) {
      errors.push(`Комната ${label}: поле "id" должно быть непустой строкой.`);
      valid = false;
    }

    const rect = r['rect'];
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(isFiniteNumber)) {
      errors.push(`Комната ${label}: поле "rect" должно быть массивом из четырёх конечных чисел [x, z, w, d].`);
      valid = false;
    } else {
      const [, , w, d] = rect as [number, number, number, number];
      if (w <= 0 || d <= 0) {
        errors.push(`Комната ${label}: ширина и глубина в "rect" должны быть положительными (получено w=${w}, d=${d}).`);
        valid = false;
      }
    }

    if (!isNonEmptyString(r['color']) || !COLOR_RE.test(r['color'])) {
      errors.push(`Комната ${label}: поле "color" должно быть строкой вида "#rgb" или "#rrggbb", получено ${JSON.stringify(r['color'])}.`);
      valid = false;
    }

    if (!isFiniteNumber(r['light']) || r['light'] < 0 || r['light'] > 1) {
      errors.push(`Комната ${label}: поле "light" должно быть числом от 0 до 1, получено ${JSON.stringify(r['light'])}.`);
      valid = false;
    }

    if (valid) {
      rooms.push({
        id: r['id'] as string,
        rect: rect as Rect,
        color: r['color'] as string,
        light: r['light'] as number,
      });
    }
  });
  return rooms;
}

function parseDoors(raw: unknown[], errors: string[]): DoorDef[] {
  const doors: DoorDef[] = [];
  raw.forEach((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`doors[${i}] должен быть объектом.`);
      return;
    }
    const r = entry as Record<string, unknown>;
    const label = isNonEmptyString(r['id']) ? `"${r['id']}"` : `#${i}`;
    let valid = true;

    if (!isNonEmptyString(r['id'])) {
      errors.push(`Дверь ${label}: поле "id" должно быть непустой строкой.`);
      valid = false;
    }

    const between = r['between'];
    if (!Array.isArray(between) || between.length !== 2 || !between.every(isNonEmptyString)) {
      errors.push(`Дверь ${label}: поле "between" должно быть массивом из двух непустых строк.`);
      valid = false;
    }

    const at = r['at'];
    if (!Array.isArray(at) || at.length !== 2 || !at.every(isFiniteNumber)) {
      errors.push(`Дверь ${label}: поле "at" должно быть массивом из двух конечных чисел.`);
      valid = false;
    }

    if (r['lock'] !== undefined && !isNonEmptyString(r['lock'])) {
      errors.push(`Дверь ${label}: поле "lock" должно быть непустой строкой.`);
      valid = false;
    }

    if (r['sign'] !== undefined && typeof r['sign'] !== 'string') {
      errors.push(`Дверь ${label}: поле "sign" должно быть строкой.`);
      valid = false;
    }

    if (valid) {
      doors.push({
        id: r['id'] as string,
        between: between as [string, string],
        at: at as [number, number],
        lock: r['lock'] as string | undefined,
        sign: r['sign'] as string | undefined,
      });
    }
  });
  return doors;
}

function parseItems(raw: unknown[], errors: string[]): ItemPlacement[] {
  const items: ItemPlacement[] = [];
  raw.forEach((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`items[${i}] должен быть объектом.`);
      return;
    }
    const r = entry as Record<string, unknown>;
    const label = isNonEmptyString(r['def']) ? `"${r['def']}"` : `#${i}`;
    let valid = true;

    if (!isNonEmptyString(r['def'])) {
      errors.push(`Предмет ${label}: поле "def" должно быть непустой строкой.`);
      valid = false;
    }
    if (!isNonEmptyString(r['room'])) {
      errors.push(`Предмет ${label}: поле "room" должно быть непустой строкой.`);
      valid = false;
    }

    const at = r['at'];
    if (!Array.isArray(at) || at.length !== 3 || !at.every(isFiniteNumber)) {
      errors.push(`Предмет ${label}: поле "at" должно быть массивом из трёх конечных чисел [x, y, z].`);
      valid = false;
    }

    if (valid) {
      items.push({
        def: r['def'] as string,
        room: r['room'] as string,
        at: at as [number, number, number],
      });
    }
  });
  return items;
}

function parseTriggers(raw: unknown[], errors: string[]): TriggerDef[] {
  const triggers: TriggerDef[] = [];
  raw.forEach((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`triggers[${i}] должен быть объектом.`);
      return;
    }
    const r = entry as Record<string, unknown>;
    const label = isNonEmptyString(r['id']) ? `"${r['id']}"` : `#${i}`;
    let valid = true;

    if (!isNonEmptyString(r['id'])) {
      errors.push(`Триггер ${label}: поле "id" должно быть непустой строкой.`);
      valid = false;
    }
    if (!isNonEmptyString(r['room'])) {
      errors.push(`Триггер ${label}: поле "room" должно быть непустой строкой.`);
      valid = false;
    }

    const rect = r['rect'];
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(isFiniteNumber)) {
      errors.push(`Триггер ${label}: поле "rect" должно быть массивом из четырёх конечных чисел.`);
      valid = false;
    }

    if (r['effect'] !== 'win') {
      errors.push(`Триггер ${label}: поле "effect" должно быть "win", получено ${JSON.stringify(r['effect'])}.`);
      valid = false;
    }

    if (valid) {
      triggers.push({
        id: r['id'] as string,
        room: r['room'] as string,
        rect: rect as Rect,
        effect: 'win',
      });
    }
  });
  return triggers;
}

// --- M9: уникальность идентификаторов сквозь все сущности. ----------------

/**
 * Предмет, дверь, замок и триггер живут в одном пространстве идентификаторов:
 * `resolveInteraction` → `classify` (`core/interactions.ts`) опознаёт цель клика
 * сначала как предмет из реестра, потом как замок, потом как дверь — по одному и
 * тому же id. Совпадение id у разных сущностей разрешится молча по этому порядку
 * приоритетов, и автор карты будет искать причину долго.
 */
function checkUniqueIds(
  rooms: RoomDef[],
  doors: DoorDef[],
  triggers: TriggerDef[],
  itemDefs: Record<string, ItemDef>,
  errors: string[],
): void {
  const owners = new Map<string, string>();
  const claim = (id: string | undefined, label: string) => {
    if (id === undefined) return;
    const prev = owners.get(id);
    if (prev) {
      errors.push(`Идентификатор "${id}" использован дважды: ${prev} и ${label}.`);
    } else {
      owners.set(id, label);
    }
  };

  for (const room of rooms) claim(room.id, `комната "${room.id}"`);
  for (const door of doors) claim(door.id, `дверь "${door.id}"`);
  for (const door of doors) if (door.lock) claim(door.lock, `замок двери "${door.id}"`);
  for (const trigger of triggers) claim(trigger.id, `триггер "${trigger.id}"`);
  for (const id of Object.keys(itemDefs)) claim(id, `предмет "${id}"`);
}

// --- I2: достижимость от точки появления. ----------------------------------

interface Reachability {
  rooms: Set<string>;
  collected: Set<string>;
}

/** Проходима ли дверь: без замка — всегда; с замком — если его уже сняли,
 * либо есть правило, которое толкает её (`toggleDoor`) собранным предметом. */
function isDoorPassable(
  door: DoorDef,
  interactions: InteractionRule[],
  collected: Set<string>,
): boolean {
  if (!door.lock) return true;
  const lock = door.lock;

  const unlocksLock = interactions.some((rule) =>
    rule.on === lock
    && collected.has(rule.use)
    && rule.effects.some((e) => e.kind === 'destroy' && e.object === lock));
  if (unlocksLock) return true;

  // Замок можно и не снимать: правило может толкать саму дверь напрямую.
  return interactions.some((rule) =>
    rule.on === door.id
    && collected.has(rule.use)
    && rule.effects.some((e) => e.kind === 'toggleDoor' && e.door === door.id));
}

/** До неподвижной точки: достижимые комнаты открывают доступ к предметам в них,
 * собранные предметы открывают двери, открытые двери — новые комнаты. */
function computeReachability(
  spawnRoom: string,
  doors: DoorDef[],
  items: ItemPlacement[],
  interactions: InteractionRule[],
): Reachability {
  const rooms = new Set<string>([spawnRoom]);
  const collected = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;

    for (const item of items) {
      if (rooms.has(item.room) && !collected.has(item.def)) {
        collected.add(item.def);
        changed = true;
      }
    }

    // Предмет можно не только поднять с пола: правило вправе выдать его эффектом
    // `take` — так предмет достают «из ящика». Без этого шага валидатор отвергал
    // бы совершенно проходимый уровень, а CLAUDE.md обещает, что новый предмет —
    // это правка данных, а не кода.
    for (const rule of interactions) {
      if (!collected.has(rule.use)) continue;
      if (!isRuleTargetReachable(rule.on, { rooms, collected }, doors, items)) continue;
      for (const effect of rule.effects) {
        if (effect.kind === 'take' && !collected.has(effect.item)) {
          collected.add(effect.item);
          changed = true;
        }
      }
    }

    for (const door of doors) {
      const [aId, bId] = door.between;
      const aReach = rooms.has(aId);
      const bReach = rooms.has(bId);
      if (!aReach && !bReach) continue;
      if (!isDoorPassable(door, interactions, collected)) continue;

      if (aReach && !rooms.has(bId)) { rooms.add(bId); changed = true; }
      if (bReach && !rooms.has(aId)) { rooms.add(aId); changed = true; }
    }
  }

  return { rooms, collected };
}

/** Достижима ли цель правила («on»): предмет, замок или дверь. */
function isRuleTargetReachable(
  targetId: string,
  reach: Reachability,
  doors: DoorDef[],
  items: ItemPlacement[],
): boolean {
  if (reach.collected.has(targetId)) return true;
  if (items.some((it) => it.def === targetId && reach.rooms.has(it.room))) return true;
  const door = doors.find((d) => d.lock === targetId || d.id === targetId);
  if (door) return reach.rooms.has(door.between[0]) || reach.rooms.has(door.between[1]);
  return false;
}

function isWinReachable(
  reach: Reachability,
  triggers: TriggerDef[],
  doors: DoorDef[],
  items: ItemPlacement[],
  interactions: InteractionRule[],
): boolean {
  if (triggers.some((t) => t.effect === 'win' && reach.rooms.has(t.room))) return true;
  return interactions.some((rule) =>
    rule.effects.some((e) => e.kind === 'win')
    && reach.collected.has(rule.use)
    && isRuleTargetReachable(rule.on, reach, doors, items));
}

export function validateLevel(
  raw: unknown,
  itemDefs: Record<string, ItemDef>,
): { ok: true; level: Level } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['Файл уровня должен содержать объект.'] };
  }
  const lvl = raw as Record<string, unknown>;

  const rooms = parseRooms(asArray(lvl, 'rooms', errors), errors);
  const doors = parseDoors(asArray(lvl, 'doors', errors), errors);
  const items = parseItems(asArray(lvl, 'items', errors), errors);
  const triggers = parseTriggers(asArray(lvl, 'triggers', errors), errors);
  const rawRules = asArray(lvl, 'interactions', errors) as Array<Record<string, unknown>>;

  // Дальше идут проверки смысла, а они опираются на разобранные сущности. Битая
  // форма означает, что часть сущностей отброшена, и каждая ссылка на них дала бы
  // «несуществующая комната» — три ложные ошибки поверх одной настоящей, и автор
  // карты пошёл бы чинить не то. Сначала форма, смысл — следующим запуском.
  if (errors.length > 0) return { ok: false, errors };

  if (rooms.length === 0) errors.push('В уровне нет ни одной комнаты.');

  const byId = new Map<string, RoomDef>();
  for (const room of rooms) {
    if (byId.has(room.id)) errors.push(`Комната "${room.id}" объявлена дважды.`);
    byId.set(room.id, room);
  }

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      if (overlap(a, b)) errors.push(`Комнаты "${a.id}" и "${b.id}" пересекаются.`);
    }
  }

  checkUniqueIds(rooms, doors, triggers, itemDefs, errors);

  const locks = new Set<string>();
  for (const door of doors) {
    const [aId, bId] = door.between;
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a) errors.push(`Дверь "${door.id}" ссылается на несуществующую комнату "${aId}".`);
    if (!b) errors.push(`Дверь "${door.id}" ссылается на несуществующую комнату "${bId}".`);
    if (a && b) {
      const check = checkSharedWall(a, b, door.at[0], door.at[1]);
      if (!check.ok && check.reason === 'off-wall') {
        errors.push(
          `Дверь "${door.id}": точка (${door.at[0]}, ${door.at[1]}) не лежит на общей стене ` +
          `комнат "${aId}" и "${bId}".`,
        );
      } else if (!check.ok && check.reason === 'seam-short') {
        errors.push(
          `Дверь "${door.id}": стык комнат "${aId}" и "${bId}" длиной ` +
          `${check.length.toFixed(2)} м короче проёма ${DOOR.width} м. Двигать дверь ` +
          `бесполезно — надо менять размеры самих комнат.`,
        );
      } else if (!check.ok && check.reason === 'too-narrow') {
        const along = doorOnVerticalWall(door, a) ? door.at[1] : door.at[0];
        const shortfall = along < check.from ? check.from - along : along - check.to;
        errors.push(
          `Дверь "${door.id}" между комнатами "${aId}" и "${bId}": проём шириной ${DOOR.width} м ` +
          `не помещается в стык, не хватает ${shortfall.toFixed(2)} м места ` +
          `(точка должна быть в диапазоне [${check.from.toFixed(2)}, ${check.to.toFixed(2)}], сейчас ${along}).`,
        );
      }
    }
    if (door.lock) locks.add(door.lock);
  }

  const seenDefs = new Set<string>();
  for (const item of items) {
    if (!itemDefs[item.def]) {
      errors.push(`Предмет ссылается на неизвестное определение "${item.def}".`);
    }
    if (seenDefs.has(item.def)) {
      errors.push(`Определение предмета "${item.def}" использовано дважды; в v1 допустим один экземпляр.`);
    }
    seenDefs.add(item.def);

    const room = byId.get(item.room);
    if (!room) {
      errors.push(`Предмет "${item.def}" лежит в несуществующей комнате "${item.room}".`);
    } else if (!contains(room, item.at[0], item.at[2])) {
      errors.push(`Предмет "${item.def}" расположен вне комнаты "${item.room}".`);
    }
  }

  for (const trigger of triggers) {
    const room = byId.get(trigger.room);
    if (!room) {
      errors.push(`Триггер "${trigger.id}" ссылается на несуществующую комнату "${trigger.room}".`);
      continue;
    }
    const [tx, tz, tw, td] = trigger.rect;
    if (!contains(room, tx, tz) || !contains(room, tx + tw, tz + td)) {
      errors.push(`Триггер "${trigger.id}" выходит за пределы комнаты "${trigger.room}".`);
    }
  }

  const interactions: InteractionRule[] = [];
  const opened = new Set<string>();
  for (const rule of rawRules) {
    const use = rule['use'];
    const on = rule['on'];
    if (typeof use !== 'string' || typeof on !== 'string') {
      errors.push(`Правило взаимодействия должно содержать строковые "use" и "on": ${JSON.stringify(rule)}`);
      continue;
    }
    if (!itemDefs[use]) errors.push(`Правило использует неизвестный предмет "${use}".`);
    const effects: Effect[] = [];
    for (const rawEffect of (rule['effects'] ?? []) as unknown[]) {
      const parsed = parseEffect(rawEffect, errors);
      if (parsed) {
        effects.push(parsed);
        if (parsed.kind === 'destroy') opened.add(parsed.object);
      }
    }
    interactions.push({ use, on, effects });
  }

  for (const lock of locks) {
    if (!opened.has(lock)) {
      errors.push(`Замок "${lock}" висит на двери, но ни одно правило его не открывает.`);
    }
  }

  const spawn = lvl['spawn'] as Level['spawn'] | undefined;
  if (!spawn) {
    errors.push('В уровне не задана точка появления игрока.');
  } else {
    const room = byId.get(spawn.room);
    if (!room) {
      errors.push(`Точка появления ссылается на несуществующую комнату "${spawn.room}".`);
    } else if (!contains(room, spawn.x, spawn.z)) {
      errors.push(`Точка появления игрока находится вне комнаты "${spawn.room}".`);
    }
  }

  // I2: достижимость. Запускаем, только если есть от чего оттолкнуться —
  // без валидной точки появления «недостижимо» ничего не говорит по существу,
  // а причина уже названа проверкой спавна выше.
  if (spawn && byId.has(spawn.room)) {
    const reach = computeReachability(spawn.room, doors, items, interactions);

    for (const door of doors) {
      if (!door.lock) continue;
      if (isDoorPassable(door, interactions, reach.collected)) continue;
      const [aId, bId] = door.between;
      const aReach = reach.rooms.has(aId);
      const bReach = reach.rooms.has(bId);
      if (aReach === bReach) continue; // не заперто именно этим замком, либо обе стороны изолированы
      const farRoomId = aReach ? bId : aId;

      const rule = interactions.find((r) =>
        r.on === door.lock && r.effects.some((e) => e.kind === 'destroy' && e.object === door.lock));
      if (!rule) continue; // «замок нечем открыть» уже сообщено выше

      const stuck = items.find((it) => it.def === rule.use && it.room === farRoomId);
      if (stuck) {
        const name = itemDefs[rule.use]?.name ?? rule.use;
        errors.push(
          `Ключ "${name}" нужен для замка "${door.lock}", но лежит в комнате "${farRoomId}", ` +
          `куда нельзя попасть, не открыв этот замок.`,
        );
      }
    }

    if (!isWinReachable(reach, triggers, doors, items, interactions)) {
      errors.push('Уровень непроходим: победа недостижима из точки появления.');
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    level: {
      id: String(lvl['id'] ?? 'level'),
      spawn: spawn!,
      rooms, doors, items, triggers, interactions, itemDefs,
    },
  };
}
