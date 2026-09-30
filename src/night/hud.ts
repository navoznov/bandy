import type { Night } from '../core/night';
import { isPrimaryPress, type NightAction } from './input';

export function clockLabel(hour: number): string {
  return `${hour === 0 ? 12 : hour} AM`;
}

const BUTTONS: Record<NightAction, string> = {
  doorLeft: '#nb-door-left',
  lightLeft: '#nb-light-left',
  vent: '#nb-vent',
  lightRight: '#nb-light-right',
  doorRight: '#nb-door-right',
  monitor: '#nb-monitor',
};

export interface NightHud {
  show(): void;
  hide(): void;
  update(night: Night): void;
}

function el(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Разметка ночи не найдена: ${selector}`);
  return found;
}

/** Пишет в DOM, только когда значение изменилось: HUD обновляется каждый кадр. */
function setText(target: HTMLElement, text: string): void {
  if (target.textContent !== text) target.textContent = text;
}

export function createNightHud(act: (action: NightAction) => void): NightHud {
  const root = el('#night');
  const clock = el('#night-clock');
  const power = el('#night-power');
  const buttons = new Map<NightAction, HTMLElement>();

  for (const [action, selector] of Object.entries(BUTTONS) as Array<[NightAction, string]>) {
    const button = el(selector);
    // pointerdown, а не click: кнопка жмётся вторым пальцем, пока первый крутит
    // обзор (PR #11). preventDefault не даёт кнопке забрать фокус — иначе пробел
    // нажал бы её второй раз.
    button.addEventListener('pointerdown', (event) => {
      if (!isPrimaryPress(event)) return;
      event.preventDefault();
      act(action);
    });
    buttons.set(action, button);
  }

  const on = (action: NightAction, value: boolean): void => {
    buttons.get(action)?.classList.toggle('on', value);
  };

  return {
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
    update(night) {
      setText(clock, clockLabel(night.hour));
      setText(power, `${Math.ceil(night.power)}%  ${'▮'.repeat(night.bars())}`);
      on('doorLeft', night.isClosed('left'));
      on('doorRight', night.isClosed('right'));
      on('vent', night.isClosed('vent'));
      on('lightLeft', night.isLit('left'));
      on('lightRight', night.isLit('right'));
      on('monitor', night.monitorUp);
      root.classList.toggle('monitor', night.monitorUp);
      root.classList.toggle('dead', night.status === 'blackout');
    },
  };
}
