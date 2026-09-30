import type { Night } from '../core/night';
import type { Level, NightDef } from '../core/types';
import { isPrimaryPress } from './input';
import { MAP_HEIGHT, MAP_WIDTH, mapLayout } from './map';

export interface Monitor {
  show(): void;
  hide(): void;
  update(night: Night): void;
}

function el(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Разметка монитора не найдена: ${selector}`);
  return found;
}

/** Квадрат шума один раз; каждый кадр он лишь сдвигается — это дешевле, чем рисовать заново. */
function noiseUrl(): string {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return '';
  const image = g.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function createMonitor(level: Level, def: NightDef, select: (id: string) => void): Monitor {
  const root = el('#monitor');
  const grain = el('#monitor-grain');
  const label = el('#monitor-cam');
  const map = el('#monitor-map');

  grain.style.backgroundImage = `url(${noiseUrl()})`;

  const layout = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
  for (const room of layout.rooms) {
    const box = document.createElement('div');
    box.className = room.office ? 'map-room office' : 'map-room';
    box.style.left = `${room.x}px`;
    box.style.top = `${room.y}px`;
    box.style.width = `${room.w}px`;
    box.style.height = `${room.h}px`;
    if (room.office) box.textContent = 'ТЫ';
    map.append(box);
  }
  const buttons = new Map<string, HTMLButtonElement>();
  for (const cam of layout.cameras) {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'map-cam';
    button.textContent = cam.id;
    button.style.left = `${cam.x}px`;
    button.style.top = `${cam.y}px`;
    button.addEventListener('pointerdown', (event) => {
      if (!isPrimaryPress(event)) return;
      event.preventDefault();
      select(cam.id);
    });
    map.append(button);
    buttons.set(cam.id, button);
  }

  let shownCamera = '';

  return {
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
    update(night) {
      if (night.camera !== shownCamera) {
        shownCamera = night.camera;
        label.textContent = `CAM ${night.camera}`;
        for (const [id, button] of buttons) button.classList.toggle('on', id === night.camera);
      }
      grain.style.backgroundPosition = `${Math.random() * 128}px ${Math.random() * 128}px`;
      grain.style.opacity = night.staticLeft > 0 ? '0.9' : '0.18';
    },
  };
}
