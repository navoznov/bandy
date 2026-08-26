let shown = false;

/** Показывает читаемый экран ошибки. Повторные вызовы игнорируются. */
export function showFatal(title: string, lines: string[]): void {
  if (shown) return;
  shown = true;

  const root = document.querySelector<HTMLElement>('#fatal');
  const titleEl = document.querySelector<HTMLElement>('#fatal-title');
  const bodyEl = document.querySelector<HTMLElement>('#fatal-body');
  if (!root || !titleEl || !bodyEl) {
    // Разметки нет — падать молча нельзя, поэтому хотя бы в консоль.
    console.error(title, lines);
    return;
  }

  titleEl.textContent = title;
  bodyEl.textContent = lines.join('\n');
  root.hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
}

export function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl === null) return false;
    // Проба занимает один слот из примерно шестнадцати, которые браузер держит
    // на вкладку, а настоящий рендер создаёт контекст следом. Отпускаем сразу.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
