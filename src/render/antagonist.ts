import * as THREE from 'three';
import { ANTAGONIST } from '../config';

/**
 * Две коробки и плоский цвет. Без текстур (требование заказчика) и без теней
 * (первое, что съедает fps на мобильных GPU). Лёгкое свечение — чтобы читался
 * в комнатах с light 0.4, а не растворялся в них.
 */
export function createAntagonistMesh(): {
  group: THREE.Group;
  update(x: number, z: number, facing: number): void;
} {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#2b2f36', emissive: '#171a1f', emissiveIntensity: 0.6,
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(ANTAGONIST.radius * 2, 1.35, ANTAGONIST.radius * 1.4), material);
  body.position.y = 0.675;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), material);
  head.position.y = 1.5;
  group.add(body, head);

  return {
    group,
    update(x, z, facing) {
      group.position.set(x, 0, z);
      // `facing` задан тем же соглашением, что и yaw игрока: взгляд в (-sin, -cos).
      // Собственное «вперёд» объекта в three.js — тоже -Z, поэтому пересчёта нет.
      group.rotation.y = facing;
    },
  };
}
