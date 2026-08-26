import rawLevel01 from './level_01.json';
import rawLevel02 from './level_02.json';
import rawLevel03 from './level_03.json';
import rawItems from './items.json';
import { validateLevel } from '../core/validate';
import type { ItemDef, Level } from '../core/types';

export type LoadResult = { ok: true; level: Level } | { ok: false; errors: string[] };

/**
 * Порядок прохождения — свойство игры, а не уровня. Поле `next` внутри JSON
 * проверить невозможно: валидатор видит один уровень и о существовании
 * следующего не знает, то есть опечатка всплыла бы у игрока, а не у автора карты.
 */
const LEVELS: ReadonlyArray<{ id: string; raw: unknown }> = [
  { id: 'level_01', raw: rawLevel01 },
  { id: 'level_02', raw: rawLevel02 },
  { id: 'level_03', raw: rawLevel03 },
];

const ITEM_DEFS = rawItems as unknown as Record<string, ItemDef>;

/** Неизвестный или отсутствующий идентификатор даёт первый уровень: чужая ссылка
 *  не повод показывать игроку экран ошибки. */
export function loadLevel(id?: string): LoadResult {
  const entry = LEVELS.find((level) => level.id === id) ?? LEVELS[0];
  if (!entry) throw new Error('Реестр уровней пуст.');
  return validateLevel(entry.raw, ITEM_DEFS);
}

export function nextLevelId(current: string): string | null {
  const index = LEVELS.findIndex((level) => level.id === current);
  if (index === -1) return null;
  return LEVELS[index + 1]?.id ?? null;
}
