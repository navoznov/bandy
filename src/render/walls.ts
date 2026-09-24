import * as THREE from 'three';
import { DOOR, ROOM } from '../config';
import { buildColliders } from '../core/colliders';
import { doorOnVerticalWall, roomBounds } from '../core/validate';
import type { Level } from '../core/types';
import { EDGE_MATERIAL, WALL_MATERIAL } from './materials';
import { wallMaterial } from './wallpaper';

function materialOf(level: Level, roomId: string | undefined): THREE.Material {
  const style = level.rooms.find((r) => r.id === roomId)?.style;
  return style === undefined ? WALL_MATERIAL : wallMaterial(style);
}

/**
 * UV в мировых единицах: u — метры вдоль грани, v — доля высоты комнаты.
 * Стандартные UV коробки растягивают тайл на всю грань, и узор на стене в
 * десять метров был бы в десять раз шире, чем на куске в метр рядом.
 */
function worldUv(geometry: THREE.BoxGeometry, cx: number, cy: number, cz: number): void {
  const pos = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const y = pos.getY(i) + cy;
    const z = pos.getZ(i) + cz;
    if (Math.abs(normal.getX(i)) > 0.5) uv.setXY(i, z, y / ROOM.height);
    else if (Math.abs(normal.getZ(i)) > 0.5) uv.setXY(i, x, y / ROOM.height);
    else uv.setXY(i, x, z);
  }
  uv.needsUpdate = true;
}

function addBox(
  group: THREE.Group,
  x0: number, x1: number, z0: number, z1: number,
  yBottom: number, yTop: number,
  material: THREE.Material | THREE.Material[],
): void {
  const geometry = new THREE.BoxGeometry(x1 - x0, yTop - yBottom, z1 - z0);
  const cx = (x0 + x1) / 2;
  const cy = (yBottom + yTop) / 2;
  const cz = (z0 + z1) / 2;
  worldUv(geometry, cx, cy, cz);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(cx, cy, cz);
  group.add(mesh);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), EDGE_MATERIAL);
  edges.position.copy(mesh.position);
  group.add(edges);
}

export function buildWalls(level: Level): THREE.Group {
  const group = new THREE.Group();

  for (const box of buildColliders(level)) {
    if (box.doorId !== undefined) continue; // створки строит doors.ts
    addBox(group, box.x0, box.x1, box.z0, box.z1, 0, ROOM.height, materialOf(level, box.roomId));
  }

  // Перемычка над каждым дверным проёмом. Стены комнат уходят внутрь на ПОЛНЫЕ
  // ROOM.wallThickness с каждой стороны границы (см. colliders.ts), поэтому
  // перемычка тоже должна перекрывать стык на полную толщину, а не на половину:
  // иначе между ней и обеими стенами остаётся ниша глубиной wallThickness/2 (M2).
  const halfDoor = DOOR.width / 2;
  const lintelReach = ROOM.wallThickness;
  for (const door of level.doors) {
    const [dx, dz] = door.at;
    const room = level.rooms.find((r) => r.id === door.between[0]);
    const other = level.rooms.find((r) => r.id === door.between[1]);
    if (!room || !other) continue;

    // Перемычка одна на две комнаты, поэтому каждая её сторона берёт стиль своей.
    // Порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z.
    const a = materialOf(level, room.id);
    const b = materialOf(level, other.id);
    if (doorOnVerticalWall(door, room)) {
      const roomOnPlus = roomBounds(room).x0 === dx;
      const faces = roomOnPlus ? [a, b, a, a, a, a] : [b, a, a, a, a, a];
      addBox(group, dx - lintelReach, dx + lintelReach, dz - halfDoor, dz + halfDoor,
             DOOR.height, ROOM.height, faces);
    } else {
      const roomOnPlus = roomBounds(room).z0 === dz;
      const faces = roomOnPlus ? [a, a, a, a, a, b] : [a, a, a, a, b, a];
      addBox(group, dx - halfDoor, dx + halfDoor, dz - lintelReach, dz + lintelReach,
             DOOR.height, ROOM.height, faces);
    }
  }

  return group;
}
