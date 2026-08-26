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
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}
