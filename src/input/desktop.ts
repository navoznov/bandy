import { emptyState, type InputSource, type InputState } from './types';

/**
 * Все хоткеи читаются через event.code — это физическая клавиша.
 * event.key сломался бы при переключении раскладки.
 */
export function createDesktopInput(canvas: HTMLCanvasElement): InputSource {
  const state: InputState = emptyState();
  const pressed = new Set<string>();
  let locked = false;
  // Первое mousemove после захвата приносит не движение, а дельту от того места,
  // где курсор был до захвата. Пока захват возвращали кликом, это не проявлялось:
  // клик сам ставит опорную точку туда, где захват и произойдёт. Возврат по
  // клавише (закрытие рюкзака) такой опоры не даёт, и камера прыгала в сторону.
  let skipNextMove = false;

  function requestLock(): void {
    if (locked) return;
    // На iPhone Safari Pointer Lock не существует вовсе, и метод там undefined.
    // Десктопный источник остаётся живым после переключения на тач, а тап
    // синтезирует click — без этой проверки каждое касание экрана бросало бы
    // TypeError. Синхронный бросок, catch ниже его не поймал бы.
    if (typeof canvas.requestPointerLock !== 'function') return;
    // Отказ бывает штатным: Chrome примерно 1.25 с после Escape захват не отдаёт,
    // и без catch это всплыло бы необработанным отказом промиса. Но молчать обо
    // всех подряд нельзя — запрет из permissions-policy во фрейме выглядел бы как
    // неработающий клик без единого следа в консоли.
    // Промис-версия Pointer Lock появилась в спецификации позже самого API, и
    // браузер, где метод есть, а промиса нет, вернул бы undefined. Синхронный
    // TypeError на `.catch` поднялся бы в глобальную ловушку ошибок и подменил бы
    // игру красным экраном падения — на единственном пути, которым её начинают.
    Promise.resolve(canvas.requestPointerLock()).catch((error: unknown) => {
      console.warn('Захват курсора не удался:', error);
    });
  }

  canvas.addEventListener('click', requestLock);

  document.addEventListener('pointerlockchange', () => {
    const was = locked;
    locked = document.pointerLockElement === canvas;
    if (locked && !was) skipNextMove = true;
    if (!locked) pressed.clear();
  });

  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    if (skipNextMove) {
      skipNextMove = false;
      return;
    }
    state.look.dx += event.movementX;
    state.look.dy += event.movementY;
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    pressed.add(event.code);
    if (event.code === 'KeyE') state.interact = true;
    if (event.code === 'KeyI' || event.code === 'Tab') {
      state.toggleInventory = true;
      event.preventDefault(); // Tab иначе уведёт фокус со страницы
    }
  });

  window.addEventListener('keyup', (event) => pressed.delete(event.code));
  window.addEventListener('blur', () => pressed.clear());

  function axis(negative: string, positive: string): number {
    return (pressed.has(positive) ? 1 : 0) - (pressed.has(negative) ? 1 : 0);
  }

  return {
    state,
    scheme: 'desktop',
    isLocked: () => locked,
    requestLock,
    // Экранной кнопки «Действие» на десктопе нет — подсвечивать нечего.
    setInteractAvailable() {},
    consume() {
      state.move.x = axis('KeyA', 'KeyD');
      state.move.y = axis('KeyW', 'KeyS');
      state.look.dx = 0;
      state.look.dy = 0;
      state.interact = false;
      state.toggleInventory = false;
    },
  };
}
