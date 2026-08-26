import * as THREE from 'three';
import type { Level } from '../core/types';

const ITEM_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xd9b64a, roughness: 0.35, metalness: 0.7,
});

/**
 * Форма предмета в мире. Моделей нет, поэтому все предметы — небольшие бруски.
 * Геометрия общая на все предметы и на руку, поэтому её нельзя освобождать
 * при исчезновении одного предмета.
 */
export const ITEM_GEOMETRY = new THREE.BoxGeometry(0.09, 0.03, 0.22);

export function buildItems(level: Level): {
  group: THREE.Group;
  targets: THREE.Object3D[];
} {
  const group = new THREE.Group();
  const targets: THREE.Object3D[] = [];

  for (const placement of level.items) {
    const mesh = new THREE.Mesh(ITEM_GEOMETRY, ITEM_MATERIAL);
    mesh.position.set(placement.at[0], placement.at[1], placement.at[2]);
    mesh.userData['targetId'] = placement.def;
    group.add(mesh);
    targets.push(mesh);
  }

  // Убирает подобранный предмет из сцены НЕ этот модуль, а scene.ts: он же ведёт
  // список целей луча, и снять меш нужно из обоих мест одновременно.
  return { group, targets };
}
