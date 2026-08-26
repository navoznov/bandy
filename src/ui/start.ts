export interface StartOverlay {
  /** Виден ли оверлей. Пока виден, игрок не двигается и камера не крутится. */
  isVisible(): boolean;
  /** Инвентарь закрывает экран целиком — под ним оверлей прячется. */
  setInventoryOpen(open: boolean): void;
  /** Игра кончилась: оверлей больше не нужен и сам не вернётся. */
  dismiss(): void;
}

/**
 * Один оверлей закрывает три дыры сразу: первый экран («Нажми, чтобы начать» —
 * Pointer Lock требует жеста пользователя), пауза по Escape и замерший экран
 * после закрытия инвентаря. Все три — один и тот же случай «управление не
 * захвачено», поэтому и элемент один.
 *
 * `coarse` — тот же `matchMedia('(pointer: coarse)')`, которым решается показ
 * экранного управления. Блоки с перечнем управления переключает CSS по тому же
 * критерию; здесь он нужен только строке действия.
 */
export function createStartOverlay(coarse: boolean): StartOverlay {
  const root = document.querySelector<HTMLElement>('#start');
  const title = document.querySelector<HTMLElement>('#start-title');
  const action = document.querySelector<HTMLElement>('#start-action');
  if (!root || !title || !action) throw new Error('Разметка стартового экрана не найдена.');

  if (coarse) action.textContent = 'Коснись, чтобы начать';

  let visible = true;
  let shownOnce = false;
  let dismissed = false;
  let locked = false;
  let inventoryOpen = false;

  function apply(): void {
    const next = !dismissed && !inventoryOpen && !locked;
    if (next === visible) return;
    // Первый показ считается снятым только когда игра действительно началась,
    // то есть по захвату. Иначе открытый до старта инвентарь превратил бы
    // стартовый экран в «Паузу», хотя игра ещё не начиналась.
    if (!next && locked) shownOnce = true;
    visible = next;
    root!.hidden = !visible;
    // Второй и дальнейшие показы на десктопе — это пауза, а не начало игры.
    if (visible && shownOnce) {
      title!.textContent = 'Пауза';
      action!.textContent = 'Нажми, чтобы продолжить';
    }
  }

  // Десктоп: оверлей ровно тогда, когда захвата нет. Escape отпускает захват и
  // этим же открывает паузу, закрытие инвентаря — тоже. Состояние приходит
  // событием, опрашивать его в кадре незачем.
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement !== null;
    apply();
  });

  // Тач: Pointer Lock там не существует, а `isLocked()` всегда `true`, поэтому
  // завязать показ на захват нельзя. Первое касание снимает оверлей навсегда;
  // паузы по Escape на телефоне нет и не нужно.
  //
  // Кроме касаний по «поверни телефон»: в портрете этот оверлей лежит выше всех
  // и ловит на себя всё подряд. Такой тап означает «повернул телефон», а не
  // «начал играть», и, засчитанный за начало, он унёс бы стартовый экран до
  // того, как игрок в ландшафте прочитал бы хоть строчку про управление.
  const rotate = document.querySelector<HTMLElement>('#rotate');

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    if (rotate && event.target instanceof Node && rotate.contains(event.target)) return;
    dismissed = true;
    apply();
  }, { capture: true });

  return {
    isVisible: () => visible,
    setInventoryOpen(open) {
      inventoryOpen = open;
      apply();
    },
    dismiss() {
      dismissed = true;
      apply();
    },
  };
}
