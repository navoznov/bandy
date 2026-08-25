import * as THREE from 'three';
import { DOOR, ROOM } from '../config';
import { buildColliders } from '../core/colliders';
import { doorOnVerticalWall } from '../core/validate';
import type { Level } from '../core/types';
import { EDGE_MATERIAL, WALL_MATERIAL } from './materials';

function addBox(
  group: THREE.Group,
  x0: number, x1: number, z0: number, z1: number,
  yBottom: number, yTop: number,
): void {
  const geometry = new THREE.BoxGeometry(x1 - x0, yTop - yBottom, z1 - z0);
  const mesh = new THREE.Mesh(geometry, WALL_MATERIAL);
  mesh.position.set((x0 + x1) / 2, (yBottom + yTop) / 2, (z0 + z1) / 2);
  group.add(mesh);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), EDGE_MATERIAL);
  edges.position.copy(mesh.position);
  group.add(edges);
}

export function buildWalls(level: Level): THREE.Group {
  const group = new THREE.Group();

  for (const box of buildColliders(level)) {
    if (box.doorId !== undefined) continue; // створки строит doors.ts
    addBox(group, box.x0, box.x1, box.z0, box.z1, 0, ROOM.height);
  }

  // Перемычка над каждым дверным проёмом.
  const halfDoor = DOOR.width / 2;
  const halfWall = ROOM.wallThickness / 2;
  for (const door of level.doors) {
    const [dx, dz] = door.at;
    const room = level.rooms.find((r) => r.id === door.between[0]);
    if (!room) continue;

    if (doorOnVerticalWall(door, room)) {
      addBox(group, dx - halfWall, dx + halfWall, dz - halfDoor, dz + halfDoor,
             DOOR.height, ROOM.height);
    } else {
      addBox(group, dx - halfDoor, dx + halfDoor, dz - halfWall, dz + halfWall,
             DOOR.height, ROOM.height);
    }
  }

  return group;
}
