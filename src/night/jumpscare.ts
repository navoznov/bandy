import * as THREE from 'three';
import { createMonsterMesh } from './scene';

const SCARE_SECONDS = 1.0;
const SHAKE = 0.06;

export interface Jumpscare {
  start(color: string, camera: THREE.PerspectiveCamera): void;
  active(): boolean;
  /** Трясёт камеру. true — скример кончился, пора показывать экран поимки. */
  update(dt: number, camera: THREE.PerspectiveCamera): boolean;
}

export function createJumpscare(scene: THREE.Scene): Jumpscare {
  let left = 0;
  let running = false;
  const base = new THREE.Vector3();

  return {
    start(color, camera) {
      const mesh = createMonsterMesh(color);
      const yaw = camera.rotation.y;
      // Вплотную перед лицом, головой (1.5 м от ног) на уровне глаз, лицом к игроку.
      const ahead = 0.55;
      mesh.group.position.set(
        camera.position.x - Math.sin(yaw) * ahead,
        camera.position.y - 1.5,
        camera.position.z - Math.cos(yaw) * ahead,
      );
      mesh.group.rotation.y = yaw + Math.PI;
      scene.add(mesh.group);
      base.copy(camera.position);
      left = SCARE_SECONDS;
      running = true;
    },
    active: () => running,
    update(dt, camera) {
      left -= dt;
      camera.position.set(
        base.x + (Math.random() - 0.5) * SHAKE,
        base.y + (Math.random() - 0.5) * SHAKE,
        base.z,
      );
      if (left > 0) return false;
      running = false;
      camera.position.copy(base);
      return true;
    },
  };
}
