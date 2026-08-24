import rawLevel from './level_01.json';
import rawItems from './items.json';
import { validateLevel } from '../core/validate';
import type { ItemDef, Level } from '../core/types';

export function loadLevel(): { ok: true; level: Level } | { ok: false; errors: string[] } {
  return validateLevel(rawLevel, rawItems as unknown as Record<string, ItemDef>);
}
