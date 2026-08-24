import * as THREE from 'three';
import { ROOM } from '../config';
import { roomBounds } from '../core/validate';
import type { Level } from '../core/types';
import { makeGridTexture, roomMaterials } from './materials';
import { buildWalls } from './walls';

export interface SceneBuild {
  scene: THREE.Scene;
  /** Объекты, по которым бьёт луч прицела. Наполняется в задачах 10 и 11. */
  interactables: THREE.Object3D[];
}

export function buildScene(level: Level): SceneBuild {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d10);
  scene.fog = new THREE.Fog(0x0d0d10, 6, 34);

  // Полусферический свет смешивает цвет неба и цвет земли по нормали поверхности.
  // У потолка нормаль смотрит вниз, поэтому его освещает именно цвет земли —
  // если он почти чёрный, потолок гаснет, каким бы светлым ни был его материал.
  scene.add(new THREE.HemisphereLight(0xdfe4ff, 0xb0b0b0, 2.6));

  const grid = makeGridTexture();

  for (const room of level.rooms) {
    const b = roomBounds(room);
    const width = b.x1 - b.x0;
    const depth = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;

    const materials = roomMaterials(room.color, grid, width, depth);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, ROOM.height, cz);
    scene.add(ceiling);

    // Точечный источник — акцент, а не основной свет. Затухание квадратичное
    // (физически корректное с r155), поэтому яркость мала, а лампа отодвинута от
    // потолка: на 0.4 м освещённость прямо над ней была в 200 раз выше, чем в
    // дальнем углу, и потолок выжигался в белое пятно.
    const lamp = new THREE.PointLight(0xfff2dd, room.light * 2, Math.max(width, depth) * 1.6, 2);
    lamp.position.set(cx, ROOM.height - 0.75, cz);
    scene.add(lamp);
  }

  scene.add(buildWalls(level));

  return { scene, interactables: [] };
}
