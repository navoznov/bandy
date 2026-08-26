import * as THREE from 'three';
import { ITEM_GEOMETRY } from './items';

const HELD_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xe8c65a, roughness: 0.3, metalness: 0.7,
});

export interface Hand {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setItem(id: string | null): void;
  resize(aspect: number): void;
}

export function createHand(): Hand {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));

  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 2);
  camera.position.set(0, 0, 0);

  const mesh = new THREE.Mesh(ITEM_GEOMETRY, HELD_MATERIAL);
  mesh.position.set(0.24, -0.19, -0.5);
  mesh.rotation.set(0.2, -0.5, 0.35);
  mesh.visible = false;
  scene.add(mesh);

  return {
    scene,
    camera,
    setItem(id) { mesh.visible = id !== null; },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); },
  };
}
