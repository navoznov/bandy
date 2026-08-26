import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { World } from '../core/world';
import { loadLevel } from '../levels';
import { buildDoors } from './doors';

/**
 * Замок — единственная цель, до которой игрок обязан дотянуться ДО того, как
 * дверь откроется. Повешенный на дальнюю грань полотна, он оказывается в комнате
 * за запертой дверью, и уровень становится непроходим, хотя и валидацию проходит,
 * и сквозной тест ядра проходит: ядро о положении мешей не знает ничего.
 *
 * Проверяется поэтому не «замок на нужной стороне» (нужная сторона зависит от
 * того, откуда пришёл игрок, а дверь можно обойти), а более сильное свойство:
 * замок торчит в обе комнаты сразу и достижим с любой стороны.
 */
function roomBounds(rect: readonly number[]): { x0: number; z0: number; x1: number; z1: number } {
  const [x = 0, z = 0, w = 0, d = 0] = rect;
  return { x0: x, z0: z, x1: x + w, z1: z + d };
}

for (const levelId of ['level_01', 'level_02', 'level_03']) {
  describe(`замки в ${levelId}`, () => {
    const loaded = loadLevel(levelId);
    if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
    const level = loaded.level;
    const doors = buildDoors(level, new World(level));
    // В игре матрицы пересчитывает рендерер каждый кадр; здесь рендерера нет,
    // а без этого `setFromObject` вернёт локальные координаты вместо мировых.
    doors.group.updateMatrixWorld(true);

    for (const door of level.doors) {
      if (door.lock === undefined) continue;

      it(`${door.id}: замок достижим из обеих комнат`, () => {
        const mesh = doors.targets.find((t) => t.userData['targetId'] === door.lock);
        expect(mesh, `в сцене нет замка ${door.lock}`).toBeDefined();
        if (!mesh) return;

        // Габариты меша в мировых координатах: именно их видит raycaster.
        const box = new THREE.Box3().setFromObject(mesh);

        for (const roomId of door.between) {
          const room = level.rooms.find((r) => r.id === roomId);
          expect(room, `в уровне нет комнаты ${roomId}`).toBeDefined();
          if (!room) return;
          const b = roomBounds(room.rect);
          const overlaps = box.max.x > b.x0 && box.min.x < b.x1
            && box.max.z > b.z0 && box.min.z < b.z1;
          expect(
            overlaps,
            `замок ${door.lock} не заходит в комнату ${roomId}: `
            + `x ${box.min.x.toFixed(3)}..${box.max.x.toFixed(3)}, `
            + `z ${box.min.z.toFixed(3)}..${box.max.z.toFixed(3)}, `
            + `комната x ${b.x0}..${b.x1}, z ${b.z0}..${b.z1}`,
          ).toBe(true);
        }
      });
    }
  });
}
