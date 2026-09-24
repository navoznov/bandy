import type { Level } from './core/types';

/**
 * Параметры запуска для отладки: `/bandy/?antagonist=off&walls=plain&dpr=1&aa=off&fps#level_03`.
 * Живут в query, а не в хеше: хеш занят уровнем, а query переживает переход
 * «Дальше», который меняет только хеш. Работают и в проде — тормоза ищут на
 * телефоне, а туда отладочную сборку не донести.
 */
export interface DebugFlags {
  /** `antagonist=off` — уровень без антагониста, как будто блока нет в JSON. */
  antagonist: boolean;
  /** `walls=plain` — комнаты без тем, серые стены. */
  plainWalls: boolean;
  /** `dpr=1` — плотность пикселей рендера; `null` — как обычно. */
  pixelRatio: number | null;
  /** `aa=off` — без сглаживания. */
  antialias: boolean;
  /** `fps` — счётчик кадров и draw call'ов в углу. */
  fps: boolean;
}

export function parseDebug(search: string): DebugFlags {
  const params = new URLSearchParams(search);
  const dpr = Number(params.get('dpr'));
  return {
    antagonist: params.get('antagonist') !== 'off',
    plainWalls: params.get('walls') === 'plain',
    pixelRatio: params.has('dpr') && dpr > 0 ? dpr : null,
    antialias: params.get('aa') !== 'off',
    fps: params.has('fps'),
  };
}

/**
 * Флаги уровня применяются к данным, а не к рендеру: уровень без антагониста и
 * без тем — уже поддержанный случай, и весь код ниже ведёт себя честно сам.
 * Вызывается после валидации: валидатор должен видеть уровень таким, каким его
 * написал автор.
 */
export function applyDebug(level: Level, flags: DebugFlags): Level {
  if (flags.antagonist && !flags.plainWalls) return level;
  const { antagonist, ...rest } = level;
  return {
    ...(flags.antagonist && antagonist ? { ...rest, antagonist } : rest),
    rooms: flags.plainWalls ? level.rooms.map(({ style: _, ...room }) => room) : level.rooms,
  };
}
