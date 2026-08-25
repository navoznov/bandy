import * as THREE from 'three';
import { DOOR, ROOM } from '../config';
import { doorOnVerticalWall, roomBounds } from '../core/validate';
import type { Level } from '../core/types';

/** Текст рисуется на канвасе: файлов-текстур в проекте нет. */
export function makeSignTexture(text: string): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен.');

  ctx.fillStyle = '#0a1a0d';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#7dff9b';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildSigns(level: Level): THREE.Group {
  const group = new THREE.Group();

  for (const door of level.doors) {
    if (!door.sign) continue;

    const [dx, dz] = door.at;
    // Табличка вешается со стороны комнаты `between[0]` — той, ИЗ которой в дверь
    // входят. Сторону нельзя зашивать константой: PlaneGeometry односторонняя, и
    // повешенная не с той стороны табличка уедет внутрь стены и отвернётся от игрока.
    const room = level.rooms.find((r) => r.id === door.between[0]);
    if (!room) continue;
    const b = roomBounds(room);

    // MeshBasicMaterial не зависит от освещения: табличка останется яркой,
    // когда в комплексе позже выключат свет.
    const material = new THREE.MeshBasicMaterial({ map: makeSignTexture(door.sign) });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), material);

    const y = DOOR.height + (ROOM.height - DOOR.height) / 2;
    const offset = ROOM.wallThickness / 2 + 0.02;

    // Нормаль таблички смотрит в комнату. Проём лежит на той границе комнаты,
    // к которой он ближе, и с этой стороны стены нужная нам сторона — внутренняя.
    const normal = doorOnVerticalWall(door, room)
      ? new THREE.Vector3(Math.abs(dx - b.x1) < Math.abs(dx - b.x0) ? -1 : 1, 0, 0)
      : new THREE.Vector3(0, 0, Math.abs(dz - b.z1) < Math.abs(dz - b.z0) ? -1 : 1);
    plate.rotation.y = Math.atan2(normal.x, normal.z);
    plate.position.set(dx, y, dz).addScaledVector(normal, offset);

    group.add(plate);

    // Лампа отодвинута от стены, а не посажена на саму табличку. Затухание
    // физически корректное (decay 2), поэтому источник на 0.12 м от стены дал бы
    // освещённость около 3 / 0.12² ≈ 200 и стена вокруг таблички превратилась бы
    // в плоское белое пятно — ровно то, что уже случилось с потолком в задаче 8.
    // Здесь 0.5 / 0.62² ≈ 1.3: ореол заметен, пересвета нет.
    const glow = new THREE.PointLight(0x7dff9b, 0.5, 3, 2);
    glow.position.copy(plate.position).addScaledVector(normal, 0.5);
    group.add(glow);
  }

  return group;
}

/**
 * Белая стена и сильный свет в дальнем торце финального коридора.
 *
 * Допущение: коридор идёт вдоль +Z, а дальний торец — у `z1`. В уровне 1 так и
 * есть (`exit_hall` тянется с z=6 до z=26, игрок входит со стороны z=6). Обобщать
 * на четыре ориентации незачем: выходной коридор в игре один, а ошибка была бы
 * видна сразу — белая стена оказалась бы за спиной.
 */
export function buildExitGlow(level: Level): THREE.Group {
  const group = new THREE.Group();

  for (const trigger of level.triggers) {
    if (trigger.effect !== 'win') continue;
    const room = level.rooms.find((r) => r.id === trigger.room);
    if (!room) continue;
    const b = roomBounds(room);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(b.x1 - b.x0, ROOM.height),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    wall.position.set((b.x0 + b.x1) / 2, ROOM.height / 2, b.z1 - 0.05);
    wall.rotation.y = Math.PI;
    group.add(wall);

    const light = new THREE.PointLight(0xffffff, 40, 16, 2);
    light.position.set((b.x0 + b.x1) / 2, ROOM.height / 2, b.z1 - 1.2);
    group.add(light);
  }

  return group;
}
