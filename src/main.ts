import * as THREE from 'three';
import { loadLevel } from './levels';
import { hasWebGl, showFatal } from './ui/fatal';
import { applyDebug, parseDebug } from './debug';
import { runExplore } from './explore';
import { runNight } from './night/run';

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
const debug = parseDebug(location.search);
const level = applyDebug(loaded.level, debug);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: debug.antialias });
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(debug.pixelRatio ?? Math.min(window.devicePixelRatio, 2));
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

const ctx = {
  level, canvas, renderer, debug,
  isStopped: () => stopped,
  stopLoop: () => stopLoop(),
};

// Ночь — другой жанр в той же игре: ни ходьбы, ни коллизий, ни ключей. Два цикла
// в одном файле срослись бы, и каждая правка ходьбы должна была бы помнить о ночи.
if (level.night) runNight(ctx, level.night);
else runExplore(ctx);
