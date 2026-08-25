import * as THREE from 'three';
import { INTERACT_RANGE, LOOK, MAX_DELTA_SECONDS, PLAYER } from './config';
import { activeColliders, buildColliders } from './core/colliders';
import { resolveMove } from './core/collision';
import { moveDelta } from './core/movement';
import { World } from './core/world';
import { loadLevel } from './levels';
import { createInput } from './input';
import { setUseButtonEnabled } from './input/touch';
import { buildScene } from './render/scene';
import { createHand } from './render/hand';
import { createHud } from './ui/hud';
import { createInventoryUi } from './ui/inventory';
import { hasWebGl, showFatal } from './ui/fatal';

/**
 * Останавливает игровой цикл. Заполняется после создания рендерера: ловушки ниже
 * нужны раньше, чем он существует. Без этого экран ошибки от сбоя в обработчике
 * DOM-события накрывал бы картинку, а цикл продолжал бы считать и рисовать позади.
 */
let stopLoop: () => void = () => {};

window.addEventListener('error', (event) => {
  stopLoop();
  showFatal('Непойманная ошибка', [
    event.message,
    event.error instanceof Error && event.error.stack ? event.error.stack : '',
  ]);
});

window.addEventListener('unhandledrejection', (event) => {
  stopLoop();
  showFatal('Непойманный отказ промиса', [String(event.reason)]);
});

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvas) throw new Error('Канвас не найден.');

if (!hasWebGl()) {
  showFatal('WebGL недоступен', [
    'Браузер не смог создать графический контекст.',
    'Проверь, включено ли аппаратное ускорение, и попробуй другой браузер.',
  ]);
  throw new Error('WebGL недоступен');
}

const loaded = loadLevel();
if (!loaded.ok) {
  showFatal('Уровень не прошёл валидацию', loaded.errors);
  throw new Error('Уровень не прошёл валидацию');
}
const level = loaded.level;

const world = new World(level);
const allColliders = buildColliders(level);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Без тонмаппинга всё ярче единицы жёстко срезается в чистый белый, и любой
// пересвет читается плоским диском вместо мягкого блика.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
stopLoop = () => renderer.setAnimationLoop(null);

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
camera.rotation.order = 'YXZ';

const { scene, interactables, doors } = buildScene(level, world);
const hud = createHud();
const hand = createHand();
const inventoryUi = createInventoryUi(world);

const flashEl = document.querySelector<HTMLElement>('#flash');
const winEl = document.querySelector<HTMLElement>('#win');
if (!flashEl || !winEl) throw new Error('Разметка финала не найдена.');

const winTrigger = level.triggers.find((t) => t.effect === 'win');

world.on((event) => {
  if (event.kind === 'won') {
    if (document.pointerLockElement) document.exitPointerLock();
    winEl.hidden = false;
    // Экранное управление лежит ниже засветки, но кнопка рюкзака — выше неё,
    // и на белом экране победы торчала бы одна она. Игра кончилась, убираем всё.
    document.querySelector('#touch')?.setAttribute('hidden', '');
    document.querySelector('#btn-bag')?.setAttribute('hidden', '');
  }
});

const raycaster = new THREE.Raycaster();
raycaster.far = INTERACT_RANGE;
/** Центр экрана. Вынесен из цикла: в кадре нельзя мусорить аллокациями. */
const SCREEN_CENTER = new THREE.Vector2(0, 0);

world.on((event) => {
  if (event.kind === 'said') hud.flash(event.text);
});

world.on((event) => {
  if (event.kind === 'handChanged') hand.setItem(event.item);
});

const player = { x: level.spawn.x, z: level.spawn.z };
let yaw = level.spawn.yaw;
let pitch = 0;

const input = createInput(canvas);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  hand.resize(width / height);
}
window.addEventListener('resize', resize);
resize();

// Возврат из фона: сбрасываем отсчёт, чтобы первый кадр не принёс многосекундный dt.
let previous = performance.now();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) previous = performance.now();
});

renderer.setAnimationLoop((now) => {
  try {
    // Клампим шаг времени: после сворачивания вкладки он приходит в секундах
    // и телепортировал бы игрока сквозь стены.
    const dt = Math.min((now - previous) / 1000, MAX_DELTA_SECONDS);
    previous = now;

    const state = input.state;

    if (state.toggleInventory) {
      inventoryUi.toggle();
      if (inventoryUi.isOpen() && document.pointerLockElement) document.exitPointerLock();
    }
    const paused = inventoryUi.isOpen();

    if (input.isLocked() && !paused) {
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

    // Анимация створки на паузе намеренно НЕ замирает. Проходимость двери
    // переключается мгновенно в момент toggleDoor и о паузе не знает, поэтому
    // замороженное на середине полотно разошлось бы с коллайдером: игрок видел бы
    // щель, а проходил насквозь. Смотреть на анимацию всё равно некому — экран
    // закрыт оверлеем инвентаря.
    doors.update(dt, player);

    // Матрицы обновляются внутри render, то есть уже после этого места. Без явного
    // обновления луч бил бы туда, куда игрок смотрел кадр назад, и по створке в том
    // положении, в котором она была кадр назад.
    camera.updateMatrixWorld();
    doors.group.updateMatrixWorld(true);

    if (!paused) {
      raycaster.setFromCamera(SCREEN_CENTER, camera);
      const hit = raycaster.intersectObjects(interactables, false)[0];
      const targetId = hit?.object.userData['targetId'] as string | undefined;
      setUseButtonEnabled(targetId !== undefined);

      if (targetId === undefined) {
        hud.setPrompt(null);
      } else {
        const outcome = world.describe(targetId);
        if (outcome.ok) hud.setPrompt(outcome.prompt);
        else hud.setRefusal(outcome.refusal);

        if (state.interact && input.isLocked()) world.interact(targetId);
      }
    } else {
      hud.setPrompt(null);
    }

    // Тот же белый оверлей служит и засветкой на подходе, и экраном победы.
    if (winTrigger) {
      const [tx, tz, tw, td] = winTrigger.rect;
      const cx = tx + tw / 2;
      const cz = tz + td / 2;
      const distance = Math.hypot(player.x - cx, player.z - cz);
      const glow = Math.max(0, Math.min(1, (10 - distance) / 9));
      flashEl.style.opacity = String(world.won ? 1 : glow * 0.9);
    }

    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hand.scene, hand.camera);
    input.consume();
  } catch (error) {
    // Без остановки цикла браузер получит шестьдесят ошибок в секунду и вкладка ляжет.
    renderer.setAnimationLoop(null);
    showFatal('Ошибка в игровом цикле', [
      error instanceof Error ? error.message : String(error),
      error instanceof Error && error.stack ? error.stack : '',
    ]);
  }
});
