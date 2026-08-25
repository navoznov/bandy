export interface Hud {
  /** Подсказка о доступном действии. `null` прячет строку. */
  setPrompt(text: string | null): void;
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

  function show(text: string | null, refusal: boolean): void {
    if (performance.now() < flashUntil) return;
    prompt!.textContent = text ?? '';
    prompt!.classList.toggle('visible', text !== null);
    prompt!.classList.toggle('refusal', refusal);
    reticle!.classList.toggle('active', text !== null && !refusal);
  }

  return {
    setPrompt: (text) => show(text, false),
    setRefusal: (text) => show(text, true),
    flash(text) {
      flashUntil = 0;
      show(text, false);
      flashUntil = performance.now() + 2200;
    },
  };
}
