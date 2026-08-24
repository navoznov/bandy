import type {
  DoorDef, Effect, InteractionRule, ItemDef, ItemPlacement,
  Level, RoomDef, TriggerDef,
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

/** Лежит ли точка двери на стене, общей для двух комнат. */
function onSharedWall(a: RoomDef, b: RoomDef, px: number, pz: number): boolean {
  const ba = roomBounds(a);
  const bb = roomBounds(b);

  const touchesOnX = Math.abs(ba.x1 - bb.x0) < EPS || Math.abs(bb.x1 - ba.x0) < EPS;
  const zOverlap = pz >= Math.max(ba.z0, bb.z0) && pz <= Math.min(ba.z1, bb.z1);
  const xMatches = Math.abs(px - ba.x1) < EPS || Math.abs(px - ba.x0) < EPS;
  if (touchesOnX && zOverlap && xMatches) return true;

  const touchesOnZ = Math.abs(ba.z1 - bb.z0) < EPS || Math.abs(bb.z1 - ba.z0) < EPS;
  const xOverlap = px >= Math.max(ba.x0, bb.x0) && px <= Math.min(ba.x1, bb.x1);
  const zMatches = Math.abs(pz - ba.z1) < EPS || Math.abs(pz - ba.z0) < EPS;
  return touchesOnZ && xOverlap && zMatches;
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

export function validateLevel(
  raw: unknown,
  itemDefs: Record<string, ItemDef>,
): { ok: true; level: Level } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['Файл уровня должен содержать объект.'] };
  }
  const lvl = raw as Record<string, unknown>;

  const rooms = (lvl['rooms'] ?? []) as RoomDef[];
  const doors = (lvl['doors'] ?? []) as DoorDef[];
  const items = (lvl['items'] ?? []) as ItemPlacement[];
  const triggers = (lvl['triggers'] ?? []) as TriggerDef[];
  const rawRules = (lvl['interactions'] ?? []) as Array<Record<string, unknown>>;

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

  const locks = new Set<string>();
  for (const door of doors) {
    const [aId, bId] = door.between;
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a) errors.push(`Дверь "${door.id}" ссылается на несуществующую комнату "${aId}".`);
    if (!b) errors.push(`Дверь "${door.id}" ссылается на несуществующую комнату "${bId}".`);
    if (a && b && !onSharedWall(a, b, door.at[0], door.at[1])) {
      errors.push(
        `Дверь "${door.id}": точка (${door.at[0]}, ${door.at[1]}) не лежит на общей стене ` +
        `комнат "${aId}" и "${bId}".`,
      );
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
