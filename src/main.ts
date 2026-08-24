import * as THREE from 'three';
import { PLAYER } from './config';
import { loadLevel } from './levels';
import { buildScene } from './render/scene';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvas) throw new Error('Канвас не найден.');

const loaded = loadLevel();
if (!loaded.ok) throw new Error('Уровень не прошёл валидацию:\n' + loaded.errors.join('\n'));
const level = loaded.level;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
camera.position.set(level.spawn.x, PLAYER.eyeHeight, level.spawn.z);
camera.rotation.order = 'YXZ';
camera.rotation.y = level.spawn.yaw;

const { scene } = buildScene(level);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
