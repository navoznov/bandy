import * as THREE from 'three';
import { INTERACT_RANGE, LOOK, MAX_DELTA_SECONDS, PLAYER } from './config';
import { activeColliders, buildColliders } from './core/colliders';
import { resolveMove } from './core/collision';
import { moveDelta } from './core/movement';
import { World } from './core/world';
import { loadLevel } from './levels';
import { createDesktopInput } from './input/desktop';
import { buildScene } from './render/scene';
import { createHud } from './ui/hud';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvas) throw new Error('Канвас не найден.');

const loaded = loadLevel();
if (!loaded.ok) throw new Error('Уровень не прошёл валидацию:\n' + loaded.errors.join('\n'));
const level = loaded.level;

const world = new World(level);
const allColliders = buildColliders(level);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Без тонмаппинга всё ярче единицы жёстко срезается в чистый белый, и любой
// пересвет читается плоским диском вместо мягкого блика.
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
camera.rotation.order = 'YXZ';

const { scene, interactables, doors } = buildScene(level, world);
const hud = createHud();
const raycaster = new THREE.Raycaster();
raycaster.far = INTERACT_RANGE;
/** Центр экрана. Вынесен из цикла: в кадре нельзя мусорить аллокациями. */
const SCREEN_CENTER = new THREE.Vector2(0, 0);

world.on((event) => {
  if (event.kind === 'said') hud.flash(event.text);
});

const player = { x: level.spawn.x, z: level.spawn.z };
let yaw = level.spawn.yaw;
let pitch = 0;

const input = createDesktopInput(canvas);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Возврат из фона: сбрасываем отсчёт, чтобы первый кадр не принёс многосекундный dt.
let previous = performance.now();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) previous = performance.now();
});

renderer.setAnimationLoop((now) => {
  // Клампим шаг времени: после сворачивания вкладки он приходит в секундах
  // и телепортировал бы игрока сквозь стены.
  const dt = Math.min((now - previous) / 1000, MAX_DELTA_SECONDS);
  previous = now;

  const state = input.state;

  if (input.isLocked()) {
    yaw -= state.look.dx * LOOK.sensitivity;
    pitch -= state.look.dy * LOOK.sensitivity;
    pitch = Math.max(-LOOK.maxPitch, Math.min(LOOK.maxPitch, pitch));

    const delta = moveDelta(state.move, yaw, PLAYER.speed, dt);
    if (delta.x !== 0 || delta.z !== 0) {
      const boxes = activeColliders(allColliders, world.openDoors());
      const next = resolveMove(player, delta, PLAYER.radius, boxes);
      player.x = next.x;
      player.z = next.z;
    }

    world.checkTriggers(player.x, player.z);
  }

  camera.position.set(player.x, PLAYER.eyeHeight, player.z);
  camera.rotation.set(pitch, yaw, 0);

  doors.update(dt, player);

  // Матрица камеры обновляется внутри render, то есть уже после этого места.
  // Без явного обновления луч бил бы туда, куда игрок смотрел кадр назад.
  camera.updateMatrixWorld();

  raycaster.setFromCamera(SCREEN_CENTER, camera);
  const hit = raycaster.intersectObjects(interactables, false)[0];
  const targetId = hit?.object.userData['targetId'] as string | undefined;

  if (targetId === undefined) {
    hud.setPrompt(null);
  } else {
    const outcome = world.describe(targetId);
    if (outcome.ok) hud.setPrompt(outcome.prompt);
    else hud.setRefusal(outcome.refusal);

    if (state.interact && input.isLocked()) world.interact(targetId);
  }

  renderer.render(scene, camera);
  input.consume();
});
