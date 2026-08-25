import * as THREE from 'three';
import { DOOR } from '../config';
import { doorOnVerticalWall } from '../core/validate';
import type { Vec2 } from '../core/collision';
import type { Level } from '../core/types';
import type { World } from '../core/world';

const LEAF_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x6b533c, roughness: 0.85 });
const LOCK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xb8a03a, roughness: 0.4, metalness: 0.6,
});
// Размеры одинаковы у всех дверей и всех замков, поэтому геометрия общая — как
// и материалы выше. Из-за этого её нельзя освобождать при уничтожении одной цели.
const LEAF_GEOMETRY = new THREE.BoxGeometry(DOOR.width, DOOR.height, 0.06);
const LOCK_GEOMETRY = new THREE.BoxGeometry(0.14, 0.2, 0.08);

interface Leaf {
  pivot: THREE.Group;
  /** Стена стоит поперёк оси X. От этого зависит знак четверти оборота. */
  onVerticalWall: boolean;
  at: Vec2;
  closedAngle: number;
  openAngle: number;
  progress: number; // 0 закрыта, 1 открыта
  target: number;
}

export interface Doors {
  group: THREE.Group;
  targets: THREE.Object3D[];
  update(dt: number, player: Vec2): void;
}

/**
 * Куда распахнуть створку, чтобы она ушла ОТ игрока, а не ему в лицо (спека §9).
 *
 * Поворот на +π/2 переводит направление полотна +Z → +X → -Z → -X. Закрытая
 * створка на вертикальной стене смотрит в +Z, на горизонтальной — в +X, поэтому
 * знак четверти оборота у этих двух случаев противоположный. Проверено на three.js.
 */
function openAngleAwayFrom(leaf: Leaf, player: Vec2): number {
  const quarter = Math.PI / 2;
  return leaf.onVerticalWall
    ? leaf.closedAngle + (player.x < leaf.at.x ? quarter : -quarter)
    : leaf.closedAngle + (player.z < leaf.at.z ? -quarter : quarter);
}

export function buildDoors(level: Level, world: World): Doors {
  const group = new THREE.Group();
  const targets: THREE.Object3D[] = [];
  const leaves = new Map<string, Leaf>();

  for (const door of level.doors) {
    const [dx, dz] = door.at;
    const room = level.rooms.find((r) => r.id === door.between[0]);
    if (!room) continue;
    const onVerticalWall = doorOnVerticalWall(door, room);

    // Петля у одного края проёма, полотно уходит от неё.
    const pivot = new THREE.Group();
    pivot.position.set(
      onVerticalWall ? dx : dx - DOOR.width / 2,
      0,
      onVerticalWall ? dz - DOOR.width / 2 : dz,
    );
    // Поворот на θ кладёт локальный +X в мировой (cos θ, -sin θ). Полотно обязано
    // заполнить проём: на вертикальной стене — уйти в +Z, а это θ = -π/2.
    // При +π/2 створка встаёт на целую ширину двери мимо проёма. Проверено числами.
    const closedAngle = onVerticalWall ? -Math.PI / 2 : 0;
    pivot.rotation.y = closedAngle;

    const leaf = new THREE.Mesh(LEAF_GEOMETRY, LEAF_MATERIAL);
    leaf.position.set(DOOR.width / 2, DOOR.height / 2, 0);
    leaf.userData['targetId'] = door.id;
    pivot.add(leaf);
    targets.push(leaf);

    group.add(pivot);
    leaves.set(door.id, {
      pivot,
      onVerticalWall,
      at: { x: dx, z: dz },
      closedAngle,
      openAngle: closedAngle, // настоящий угол считается в момент открывания
      progress: 0,
      target: 0,
    });

    if (door.lock) {
      const lock = new THREE.Mesh(LOCK_GEOMETRY, LOCK_MATERIAL);
      lock.position.set(DOOR.width * 0.82, 1.15, 0.07);
      lock.userData['targetId'] = door.lock;
      pivot.add(lock);
      targets.push(lock);
    }
  }

  world.on((event) => {
    if (event.kind === 'doorOpened') {
      const leaf = leaves.get(event.door);
      if (leaf) leaf.target = 1;
    }
    if (event.kind === 'doorClosed') {
      const leaf = leaves.get(event.door);
      if (leaf) leaf.target = 0;
    }
    // Уничтожение цели обрабатывает scene.ts: правило одно для замков и предметов.
  });

  return {
    group,
    targets,
    update(dt, player) {
      for (const leaf of leaves.values()) {
        // Сторону выбираем в момент начала хода: только тогда известно, где игрок.
        if (leaf.target === 1 && leaf.progress === 0) {
          leaf.openAngle = openAngleAwayFrom(leaf, player);
        }
        if (leaf.progress === leaf.target) continue;
        const step = dt / DOOR.openSeconds;
        leaf.progress = leaf.target > leaf.progress
          ? Math.min(leaf.target, leaf.progress + step)
          : Math.max(leaf.target, leaf.progress - step);
        // Плавное замедление к концу хода.
        const eased = leaf.progress * leaf.progress * (3 - 2 * leaf.progress);
        leaf.pivot.rotation.y = leaf.closedAngle + (leaf.openAngle - leaf.closedAngle) * eased;
      }
    },
  };
}
