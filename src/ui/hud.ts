export interface Hud {
  /**
   * Подсказка о доступном действии. `null` прячет строку.
   * `key` — имя клавиши, которой действие делается: без него игрок читает
   * «Подобрать: Латунный ключ» и не знает, чем подбирать. На тач-схеме `null` —
   * там вместо клавиши видна кнопка «Действие».
   */
  setPrompt(text: string | null, key?: string | null): void;
  /** Причина отказа: та же строка, но другим фоном. */
  setRefusal(text: string | null): void;
  /** Короткое сообщение поверх, например текст эффекта say. */
  flash(text: string): void;
}

export function createHud(): Hud {
  const reticle = document.querySelector<HTMLElement>('#reticle');
  const prompt = document.querySelector<HTMLElement>('#prompt');
  if (!reticle || !prompt) throw new Error('Разметка HUD не найдена.');

  let flashUntil = 0;

  function writePrompt(text: string | null, refusal: boolean, key?: string | null): void {
    prompt!.textContent = text === null ? '' : key ? `[${key}] ${text}` : text;
    prompt!.classList.toggle('visible', text !== null);
    prompt!.classList.toggle('refusal', refusal);
  }

  /**
   * Прицел отражает то, на что игрок наведён ПРЯМО СЕЙЧАС, и тост его не трогает:
   * иначе любое сообщение `say` красило бы прицел активным жёлтым посреди пустой
   * комнаты и на две секунды прятало бы настоящий отказ.
   */
  function aim(text: string | null, refusal: boolean, key?: string | null): void {
    reticle!.classList.toggle('active', text !== null && !refusal);
    if (performance.now() < flashUntil) return;
    writePrompt(text, refusal, key);
  }

  return {
    setPrompt: (text, key) => aim(text, false, key),
    // Отказ клавишей не снимается — предлагать её было бы враньём.
    setRefusal: (text) => aim(text, true),
    flash(text) {
      writePrompt(text, false);
      flashUntil = performance.now() + 2200;
    },
  };
}
