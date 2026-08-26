import type { InputScheme, InputSource } from './types';
import { createDesktopInput } from './desktop';
import { createTouchInput, hideTouchUi, showTouchUi } from './touch';

export type { InputSource, InputState, InputScheme } from './types';

/**
 * Есть ли у этого экрана палец. Это вопрос о возможности устройства, а не о
 * строке user agent, и отвечает он только на «что показывать»: схема ввода
 * по-прежнему выбирается по факту события, а не по этому флагу.
 */
export function isCoarsePointer(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Событие ввода в том виде, в каком оно влияет на выбор схемы. */
export type SchemeSignal =
  | { kind: 'pointer'; pointerType: string }
  | { kind: 'key' };

/**
 * Какой схемой играют после этого события. Правило вынесено из обработчиков,
 * потому что это единственная часть выбора схемы, которую можно проверить без
 * браузера.
 *
 * Мышь опознаётся по pointer-событию с `pointerType === 'mouse'`, а не по
 * `click`/`mousemove`: тап на телефоне синтезирует и то и другое (и именно этот
 * синтетический `click` по канвасу запрашивает pointer lock на десктопной
 * схеме), но pointer-событие с типом `mouse` не синтезирует никогда. Иначе
 * первое же касание переключало бы схему обратно на десктоп.
 */
export function nextScheme(current: InputScheme, signal: SchemeSignal): InputScheme {
  if (signal.kind === 'key') return 'desktop';
  if (signal.pointerType === 'touch') return 'touch';
  if (signal.pointerType === 'mouse') return 'desktop';
  return current; // перо и всё незнакомое схему не трогают
}

/**
 * Живы обе схемы сразу, активна та, от которой пришло последнее событие.
 * Защёлка в одну сторону была бы дефектом: на ноутбуке с тачскрином одно
 * случайное касание навсегда выключало бы клавиатуру и мышь.
 */
export function createInput(canvas: HTMLCanvasElement): InputSource {
  let touch: InputSource | null = null;
  let scheme: InputScheme = 'desktop';
  const desktop = createDesktopInput(canvas, () => scheme === 'desktop');

  // Экранное управление показывается по возможности экрана, а не по факту
  // касания: иначе на первом экране телефона нет ни стика, ни кнопок, ни
  // подсказки про ландшафт — ровно то, обо что споткнулся живой игрок.
  if (isCoarsePointer()) showTouchUi();

  function switchTo(signal: SchemeSignal): void {
    const next = nextScheme(scheme, signal);
    if (next === scheme) return;
    // Тач-источник создаётся лениво: на машине без тачскрина он не нужен вовсе.
    if (next === 'touch') touch ??= createTouchInput(canvas);
    // Вернулись к мыши и клавиатуре — экранное управление убираем. Оно не только
    // мешает смотреть: клик мышью по кнопке «Действие» взводит `interact` в
    // источнике, чей `consume()` уже не зовётся, и флаг сработал бы позже, при
    // следующем касании. `consume()` гасит такой залипший флаг.
    if (next === 'desktop' && touch) {
      touch.consume();
      if (!isCoarsePointer()) hideTouchUi();
    }
    if (next === 'touch') {
      showTouchUi();
      // Захват мог быть выдан до первого касания — на Android он существует, и
      // тап синтезирует click. Под захватом координаты указателя заморожены, и
      // тач-схема получала бы все касания в точку (0, 0). Снимаем.
      if (document.pointerLockElement) document.exitPointerLock();
    }
    scheme = next;
  }

  const onPointer = (event: PointerEvent): void => {
    switchTo({ kind: 'pointer', pointerType: event.pointerType });
  };

  // capture: тач-источник должен успеть родиться до того, как событие дойдёт
  // до канваса и до его собственных обработчиков.
  window.addEventListener('pointerdown', onPointer, { capture: true });
  window.addEventListener('pointermove', onPointer, { capture: true });
  window.addEventListener('keydown', () => switchTo({ kind: 'key' }));

  const active = (): InputSource => (scheme === 'touch' && touch ? touch : desktop);

  return {
    get state() { return active().state; },
    get scheme() { return active().scheme; },
    isLocked: () => active().isLocked(),
    requestLock: () => active().requestLock(),
    consume: () => active().consume(),
    setInteractAvailable: (available) => active().setInteractAvailable(available),
  };
}
