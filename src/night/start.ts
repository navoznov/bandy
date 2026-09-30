import { hasModifier } from './input';

export interface NightStart {
  isVisible(): boolean;
}

/**
 * Стартовый экран ночи — тот же `#start`, со своим текстом. Снимается первым
 * нажатием чего угодно. Это же нажатие дальше не идёт: иначе клавиша Q сняла бы
 * экран И закрыла бы дверь, а тап по кнопке — нажал бы её.
 */
export function createNightStart(coarse: boolean, onStart: () => void): NightStart {
  const root = document.querySelector<HTMLElement>('#start');
  const title = document.querySelector<HTMLElement>('#start-title');
  const action = document.querySelector<HTMLElement>('#start-action');
  const rotate = document.querySelector<HTMLElement>('#rotate');
  if (!root || !title || !action) throw new Error('Разметка стартового экрана не найдена.');

  title.textContent = 'НОЧЬ 1';
  action.textContent = coarse ? 'Коснись, чтобы начать' : 'Нажми, чтобы начать';
  for (const id of ['#start-explore-desktop', '#start-explore-touch']) {
    document.querySelector(id)?.setAttribute('hidden', '');
  }
  for (const id of ['#start-night-desktop', '#start-night-touch']) {
    document.querySelector(id)?.removeAttribute('hidden');
  }

  let visible = true;

  function begin(event: Event): void {
    if (!visible) return;
    // Cmd+Tab и прочие сочетания браузера ночь не начинают.
    if (event instanceof KeyboardEvent && hasModifier(event)) return;
    // Тап по «поверни телефон» — это поворот телефона, а не начало ночи.
    if (rotate && event.target instanceof Node && rotate.contains(event.target)) return;
    event.stopPropagation();
    visible = false;
    root!.hidden = true;
    onStart();
  }

  // capture на window: срабатывает раньше обработчиков кнопок и клавиш.
  window.addEventListener('pointerdown', begin, { capture: true });
  window.addEventListener('keydown', begin, { capture: true });

  return { isVisible: () => visible };
}
