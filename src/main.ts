import * as THREE from 'three';
import { INTERACT_RANGE, LOOK, MAX_DELTA_SECONDS, PLAYER } from './config';
import { activeColliders, buildColliders } from './core/colliders';
import { resolveMove } from './core/collision';
import { canSprint, stepStamina } from './core/stamina';
import { moveDelta } from './core/movement';
import { Antagonist } from './core/antagonist';
import { World } from './core/world';
import { loadLevel, nextLevelId } from './levels';
import { createInput, isCoarsePointer } from './input';
import { buildScene } from './render/scene';
import { createAntagonistMesh } from './render/antagonist';
import { createHand } from './render/hand';
import { createHud } from './ui/hud';
import { createSteps } from './audio/steps';
import { createDread } from './ui/dread';
import { createInventoryUi } from './ui/inventory';
import { createStartOverlay } from './ui/start';
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

// Хеш разбирается здесь, а не в реестре: реестр обязан запускаться в тестах,
// где нет ни `location`, ни `window`.
const loaded = loadLevel(location.hash.slice(1));
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
// `setAnimationLoop(null)` из середины кадра не обрывает цепочку rAF: three
// перерегистрирует следующий кадр уже ПОСЛЕ вызова колбэка, и `stop()` отменяет
// только что сработавший id, то есть не делает ничего. Пользовательский колбэк
// действительно перестаёт вызываться, но пустая цепочка живёт вечно и будит
// телефон 60 раз в секунду на белом экране победы. Флаг обрывает её по-настоящему.
let stopped = false;
stopLoop = () => { stopped = true; renderer.setAnimationLoop(null); };

// На мобильном GPU контекст теряется при нехватке памяти и после долгого ухода
// вкладки в фон — без этого игрок получал бы чёрный экран без единого слова.
// Восстановление (`webglcontextrestored`) намеренно не делаем: сцена не умеет
// пересоздаваться, а честное сообщение лучше полурабочей картинки.
canvas.addEventListener('webglcontextlost', (event) => {
  // Без preventDefault браузер считает потерю необработанной и молча сдаётся.
  event.preventDefault();
  stopLoop();
  showFatal('Графика упала', [
    'Браузер потерял графический контекст.',
    'Так бывает при нехватке памяти или после долгого ухода вкладки в фон.',
    'Обнови страницу, чтобы начать заново.',
  ]);
});

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
camera.rotation.order = 'YXZ';

const { scene, interactables, doors } = buildScene(level, world);

// Антагониста может не быть: блок в JSON уровня необязателен.
const antagonist = level.antagonist ? new Antagonist(level, world) : null;
const antagonistMesh = antagonist ? createAntagonistMesh() : null;
if (antagonistMesh) scene.add(antagonistMesh.group);

const hud = createHud();
const hand = createHand();
const inventoryUi = createInventoryUi(world);
const dread = createDread();
const steps = createSteps();

// AudioContext без жеста пользователя не создаётся. Годится любое первое
// нажатие: на десктопе им же берут захват курсора, на телефоне им же снимают
// стартовый экран, — то есть отдельного «разреши звук» игроку не показывают.
// Оба слушателя одноразовые, а повторный unlock() безвреден: он лишь будит
// контекст, если тот успел уснуть.
//
// Только на уровне с антагонистом: единственный источник звука — его шаги, и
// на первых двух уровнях аудиопоток поднимался бы ради тишины.
if (level.antagonist) {
  const unlockAudio = (): void => steps.unlock();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
}
const start = createStartOverlay(isCoarsePointer());

const flashEl = document.querySelector<HTMLElement>('#flash');
const winEl = document.querySelector<HTMLElement>('#win');
const caughtEl = document.querySelector<HTMLElement>('#caught');
if (!flashEl || !winEl || !caughtEl) throw new Error('Разметка финала не найдена.');

const staminaEl = document.querySelector<HTMLElement>('#stamina');
const staminaFill = document.querySelector<HTMLElement>('#stamina-fill');
if (!staminaEl || !staminaFill) throw new Error('Разметка полоски выносливости не найдена.');

const nextButton = document.querySelector<HTMLButtonElement>('#win-next');
const againEl = document.querySelector<HTMLElement>('#win-again');
const nextId = nextLevelId(level.id);
if (nextButton && nextId !== null) {
  nextButton.addEventListener('click', () => {
    location.hash = nextId;
    // Перезагрузка переиспользует весь проверенный путь загрузки целиком.
    location.reload();
  });
}

// Хеш не трогаем: перезагрузка поднимет тот же уровень тем же проверенным путём,
// которым «Дальше» поднимает следующий. Автоматического рестарта нет намеренно —
// экран, мигнувший на полсекунды, не объяснит игроку, что он потерял пройденное.
document.querySelector('#caught-again')?.addEventListener('click', () => location.reload());

const winTrigger = level.triggers.find((t) => t.effect === 'win');

/**
 * Конец игры — победой или поимкой. Пять действий были написаны для экрана
 * победы; поимка добавляет второй такой же случай, поэтому общая часть здесь.
 * Это уборка дубля, который создаёт эта же правка, а не рефакторинг заодно.
 */
function endGame(overlay: HTMLElement): void {
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = false;
  // Отпущенный захват иначе тут же вернул бы стартовый экран — поверх оверлея.
  start.dismiss();
  // Цикл снимается со СЛЕДУЮЩЕГО кадра, текущий досчитывается до конца, и победа
  // этим пользуется: засветка и её экран встают на место. Дальше считать нечего —
  // на тач-схеме `isLocked()` всегда true, и без остановки игрок продолжал бы
  // ходить за финальным экраном.
  stopLoop();
  // Экранное управление лежит ниже оверлея, но кнопка рюкзака — выше него, и на
  // финальном экране торчала бы одна она. Игра кончилась, убираем всё.
  document.querySelector('#touch')?.setAttribute('hidden', '');
  document.querySelector('#btn-bag')?.setAttribute('hidden', '');
}

world.on((event) => {
  if (event.kind === 'won') {
    endGame(winEl);
    if (nextButton && nextId !== null) {
      nextButton.hidden = false;
      // «Обнови страницу, чтобы пройти заново» относится к последнему уровню.
      // Рядом с кнопкой «Дальше» это два противоречащих совета.
      if (againEl) againEl.hidden = true;
    }
  }
});

const raycaster = new THREE.Raycaster();
raycaster.far = INTERACT_RANGE;
/** Центр экрана. Вынесен из цикла: в кадре нельзя мусорить аллокациями. */
const SCREEN_CENTER = new THREE.Vector2(0, 0);

world.on((event) => {
  if (event.kind === 'said') hud.flash(event.text);
});

// Подобранный предмет молча исчезал из мира, и о существовании рюкзака игрок
// нигде не узнавал. Без этого шага цепочка «подобрать → взять в руку → открыть
// замок» не начинается, и игра непроходима для того, кто не читал README.
world.on((event) => {
  if (event.kind === 'itemTaken') {
    hud.flash(`${level.itemDefs[event.item]?.name ?? event.item} убран в рюкзак.`);
  }
});

world.on((event) => {
  if (event.kind === 'handChanged') hand.setItem(event.item);
});

const player = { x: level.spawn.x, z: level.spawn.z };
let yaw = level.spawn.yaw;
let pitch = 0;
/** Запас 0..1 и факт бега в прошлом кадре — второе нужно гистерезису `canSprint`. */
let stamina = 1;
let sprinting = false;

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
  if (stopped) return;
  try {
    // Клампим шаг времени: после сворачивания вкладки он приходит в секундах
    // и телепортировал бы игрока сквозь стены.
    const dt = Math.min((now - previous) / 1000, MAX_DELTA_SECONDS);
    previous = now;

    const state = input.state;

    if (state.toggleInventory) {
      inventoryUi.toggle();
      // Захват отпускается, потому что без курсора по списку не кликнуть. А на
      // закрытии его надо вернуть, иначе игра остаётся без управления и стартовый
      // оверлей показывает паузу, которой игрок не просил: он всего лишь закрыл
      // рюкзак. Нажатие клавиши — пользовательский жест, и запрос из этого же
      // кадра проходит. Если браузер всё же откажет, оверлей остаётся страховкой:
      // «Нажми, чтобы продолжить» — это лучше молча замершего экрана.
      if (inventoryUi.isOpen()) {
        if (document.pointerLockElement) document.exitPointerLock();
      } else {
        start.expectLock();
        input.requestLock();
      }
    }
    const paused = inventoryUi.isOpen();
    start.setInventoryOpen(paused);

    // На десктопе видимость оверлея и так означает отсутствие захвата, но на
    // тач-схеме `isLocked()` всегда true — там игрока держит именно эта проверка.
    if (input.isLocked() && !paused && !start.isVisible()) {
      yaw -= state.look.dx * LOOK.sensitivity;
      pitch -= state.look.dy * LOOK.sensitivity;
      pitch = Math.max(-LOOK.maxPitch, Math.min(LOOK.maxPitch, pitch));

      // Порядок важен: сначала решаем, бежит ли он в ЭТОМ кадре, потом считаем шаг
      // этой скоростью, потом списываем запас. Иначе полоска и скорость расходятся
      // на кадр, и на глаз это выглядит как рывок в момент, когда запас кончился.
      const wantsToMove = state.move.x !== 0 || state.move.y !== 0;
      sprinting = state.sprint && wantsToMove && canSprint(stamina, sprinting);
      const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.speed;
      stamina = stepStamina(stamina, sprinting, dt);

      // Показывается только когда запас неполный: пока игрок исследует, экран
      // чистый, а полоска появляется в момент первого бега и этим себя объясняет.
      staminaEl.hidden = stamina >= 1;
      staminaFill.style.width = `${Math.round(stamina * 100)}%`;
      input.setSprintAvailable(canSprint(stamina, sprinting));

      const delta = moveDelta(state.move, yaw, speed, dt);
      if (delta.x !== 0 || delta.z !== 0) {
        const boxes = activeColliders(allColliders, world.openDoors());
        const next = resolveMove(player, delta, PLAYER.radius, boxes);
        player.x = next.x;
        player.z = next.z;
      }

      world.checkTriggers(player.x, player.z);

      // Под тем же условием, что и игрок: инвентарь ставит игру на паузу, и без
      // этого антагонист шёл бы, пока игрок листает рюкзак, и ловил бы его сквозь
      // оверлей.
      if (antagonist) {
        antagonist.step(dt, player, activeColliders(allColliders, world.openDoors()));
        // Расстояние по графу комнат, а не по прямой: он бывает в трёх метрах за
        // стеной шахты и в двадцати метрах ходьбы, и тревожить в этот момент
        // значит врать. Считается один раз на двоих — обход графа не бесплатный,
        // и разойтись в оценке близости эти двое не должны.
        const distance = antagonist.distanceTo(player);
        dread.update(distance, antagonist.state === 'chase', dt);

        // Панорама по углу между взглядом игрока и направлением на антагониста:
        // «шаги слева» получаются одной строкой. Знак проверен выводом, а не на
        // слух: камера при yaw смотрит в (-sin, -cos), значит «вправо» — это
        // (cos, -sin), и sin(toHim - yaw) — уже готовая проекция на этот вектор.
        // Контроль: yaw = 0, он на +x (справа) → угол +π/2 → pan = +1, правый
        // канал. Приводить разность углов к (-π, π] незачем: синус периодичен.
        const toHim = Math.atan2(antagonist.x - player.x, antagonist.z - player.z);
        steps.update(distance, Math.sin(toHim - yaw), dt);
        if (antagonist.caught(player)) {
          endGame(caughtEl);
          // Кадр досчитывать нечего: экран поимки непрозрачный и закрывает всё.
          return;
        }
      }
    }

    camera.position.set(player.x, PLAYER.eyeHeight, player.z);
    camera.rotation.set(pitch, yaw, 0);

    if (antagonist && antagonistMesh) {
      antagonistMesh.update(antagonist.x, antagonist.z, antagonist.facing);
    }

    // Анимация створки на паузе намеренно НЕ замирает. Проходимость двери
    // переключается мгновенно в момент toggleDoor и о паузе не знает, поэтому
    // замороженное на середине полотно разошлось бы с коллайдером: игрок видел бы
    // щель, а проходил насквозь. Смотреть на анимацию всё равно некому — экран
    // закрыт оверлеем инвентаря.
    doors.update(dt, player);

    // Матрицы обновляются внутри render, то есть уже после этого места. Без явного
    // обновления луч бил бы туда, куда игрок смотрел кадр назад, и по створке в том
    // положении, в котором она была кадр назад. Обновляем сцену целиком, а не одни
    // створки: на первом кадре меши предметов ещё стоят в начале координат, и любой
    // объект, добавленный в сцену в рантайме, попал бы в ту же ловушку.
    // Камера отдельно — она не в графе сцены.
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();

    // Под стартовым экраном и паузой цель не подсвечивается: игрок туда не
    // смотрит, а подсказка проступала бы сквозь затемнение.
    if (!paused && !start.isVisible()) {
      raycaster.setFromCamera(SCREEN_CENTER, camera);
      const hit = raycaster.intersectObjects(interactables, false)[0];
      const targetId = hit?.object.userData['targetId'] as string | undefined;
      input.setInteractAvailable(targetId !== undefined);

      if (targetId === undefined) {
        hud.setPrompt(null);
      } else {
        const outcome = world.describe(targetId);
        const key = input.scheme === 'desktop' ? 'E' : null;
        if (outcome.ok) hud.setPrompt(outcome.prompt, key);
        // Пока цель не пробовали, отказ показывается обычной подсказкой — с клавишей
        // и активным прицелом. Через `setRefusal` красный фон выдал бы загадку не
        // хуже текста, ради которого всё и затевалось.
        else if (outcome.untried !== undefined) hud.setPrompt(outcome.untried, key);
        else hud.setRefusal(outcome.refusal);

        if (state.interact && input.isLocked()) world.interact(targetId);
      }
    } else {
      hud.setPrompt(null);
      input.setInteractAvailable(false);
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
