import { describe, expect, it } from 'vitest';
import { Antagonist } from './antagonist';
import { World } from './world';
import { loadLevel } from '../levels';
import { ANTAGONIST } from '../config';
import { activeColliders, bodyHits, buildColliders } from './colliders';
import { roomAt } from './pathing';
import type { WorldEvent } from './world';

function fresh(): { world: World; ai: Antagonist } {
  const loaded = loadLevel('level_03');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const world = new World(loaded.level);
  return { world, ai: new Antagonist(loaded.level, world) };
}

/** Прогоняет N секунд игрового времени шагами по 16 мс. */
function run(ai: Antagonist, seconds: number, player = { x: -100, z: -100 }): void {
  const steps = Math.round(seconds / 0.016);
  for (let i = 0; i < steps; i++) ai.step(0.016, player, []);
}

describe('патруль', () => {
  it('появляется в точке из данных уровня', () => {
    const { ai } = fresh();
    expect(ai.x).toBeCloseTo(11);
    expect(ai.z).toBeCloseTo(13);
    expect(ai.state).toBe('patrol');
  });

  it('обходит уровень, а не топчется на месте', () => {
    const { world, ai } = fresh();
    const level = world.level;
    const visited = new Set<string>();
    for (let i = 0; i < 60 / 0.016; i++) {
      ai.step(0.016, { x: -100, z: -100 }, []);
      const room = roomAt(level, { x: ai.x, z: ai.z });
      if (room) visited.add(room);
    }
    // Смещение от точки появления мерить нельзя: обход цикличен, и в случайный
    // момент он оказывается ровно там, откуда вышел. За минуту он проходит семь
    // комнат — требуем пять, чтобы порог не зависел от фазы.
    expect(visited.size).toBeGreaterThanOrEqual(5);
    // Кухня заперта медным замком, и он его не открывает. Ни разу за минуту.
    // Это и есть механика убежища, записанная в спеке §2.
    expect(visited.has('kitchen')).toBe(false);
  });

  it('открывает закрытые двери на пути', () => {
    const { world, ai } = fresh();
    expect(world.isDoorOpen('d_ring_ne')).toBe(false);
    run(ai, 60);
    // За минуту он успевает уйти с севера в кабинет через кольцо.
    expect(world.openDoors().size).toBeGreaterThan(0);
  });

  it('запертую дверь не открывает никогда', () => {
    const { world, ai } = fresh();
    run(ai, 300);
    expect(world.isDoorOpen('d_hall_kitchen')).toBe(false);
    expect(world.isDestroyed('lock_copper')).toBe(false);
  });

  it('дверь из keepOpen не закрывает за собой', () => {
    const { world, ai } = fresh();
    // Открытие в конце — не доказательство прохода: он мог с тем же успехом
    // никогда не заходить в кольцо. Слушаем реальные события открытия дверей,
    // а не финальное состояние, которое зависит от топологии графа и порядка
    // дверей в JSON и однажды может остаться зелёным без причины.
    const opened = new Set<string>();
    world.on((event: WorldEvent) => {
      if (event.kind === 'doorOpened') opened.add(event.door);
    });
    run(ai, 300);

    const ring = ['d_ring_sw', 'd_ring_se', 'd_ring_nw', 'd_ring_ne'];
    // Каждая дверь кольца реально была пройдена — не только в итоге открыта.
    expect(ring.every((id) => opened.has(id))).toBe(true);

    const closedRing = ring.filter((id) => !world.isDoorOpen(id));
    // И осталась открытой: ни одна не захлопнулась за ним по возвращении.
    expect(closedRing).toEqual([]);
  });

  it('тело нигде не задевает стены за весь обход', () => {
    const { world, ai } = fresh();
    // Геометрия уровня статична — коллайдеры строятся один раз, а не на каждой
    // из восемнадцати тысяч итераций. Меняется только набор открытых дверей.
    const all = buildColliders(world.level);
    const violations: string[] = [];

    for (let i = 0; i < 300 / 0.016; i++) {
      ai.step(0.016, { x: -100, z: -100 }, []);
      const boxes = activeColliders(all, world.openDoors());
      if (bodyHits(ai, ANTAGONIST.radius, boxes)) {
        violations.push(`${(i * 0.016).toFixed(1)} с: (${ai.x.toFixed(2)}, ${ai.z.toFixed(2)})`);
        // Первого нарушения достаточно: дальше он всё равно уже не там, где должен.
        break;
      }
    }

    // Одна проверка вместо девятисот тысяч. Сообщение при падении называет
    // секунду и координаты — по ним видно, на какой двери сломалась геометрия.
    expect(violations).toEqual([]);
  });
});

describe('состояния', () => {
  it('увидев игрока, переходит в погоню', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    // hall_n глубиной всего 2 м (z: 12..14), спавн ровно на середине (z=13),
    // и на x=11 (спавн) нет двери ни на южной, ни на северной стене — 2 м в
    // любую сторону от спавна уводят прямо в стену. 0.7 м остаётся внутри.
    const inFront = { x: ai.x, z: ai.z - 0.7 };
    ai.facing = 0;                        // взгляд в -z
    ai.step(0.016, inFront, boxes);
    expect(ai.seesPlayer).toBe(true);
    expect(ai.state).toBe('chase');
  });

  it('за спиной не замечает', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    ai.facing = 0;
    ai.step(0.016, { x: ai.x, z: ai.z + 1 }, boxes);
    expect(ai.seesPlayer).toBe(false);
    expect(ai.state).toBe('patrol');
  });

  it('потеряв игрока, ищет, а через searchSeconds возвращается к патрулю', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    ai.facing = 0;
    // 0.7 м, не 2 — hall_n глубиной 2 м, а на x=11 нет двери ни на одной стене.
    ai.step(0.016, { x: ai.x, z: ai.z - 0.7 }, boxes);
    expect(ai.state).toBe('chase');

    const far = { x: -100, z: -100 };
    ai.step(0.016, far, boxes);
    expect(ai.state).toBe('search');

    for (let i = 0; i < (ANTAGONIST.searchSeconds + 2) / 0.016; i++) ai.step(0.016, far, boxes);
    expect(ai.state).toBe('patrol');
  });

  it('ловля требует и дистанции, и видимости', () => {
    const { world, ai } = fresh();
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());
    ai.facing = 0;
    const behind = { x: ai.x, z: ai.z + 0.5 };
    ai.step(0.016, behind, boxes);
    expect(ai.caught(behind)).toBe(false);   // метр за спиной безопасен

    // Один шаг патруля (не увидел behind) уже сдвинул его и довернул взгляд —
    // без повторного ai.facing = 0 "перед собой" считалось бы от старого угла.
    ai.facing = 0;
    const front = { x: ai.x, z: ai.z - 0.5 };
    ai.step(0.016, front, boxes);
    expect(ai.caught(front)).toBe(true);
  });

  it('в погоне двери за собой не закрывает', () => {
    const { world, ai } = fresh();
    // Дверь уже открыта — так и есть в реальной игре: чтобы оказаться в
    // соседней комнате, игрок обязан был сам её открыть (закрытая дверь —
    // полноценный коллайдер и для него, и для антагониста); он не мог
    // материализоваться за ней. Открытая дверь — то состояние, в котором
    // антагонист реально застаёт эту дверь, когда идёт следом.
    world.applyEffects([{ kind: 'toggleDoor', door: 'd_hall_nursery' }]);
    // Спавн в hall_n (11, 13). Игрок рядом, в той же комнате, лицом к нему —
    // сразу погоня, без разбега патрулём в произвольную сторону.
    const player = { x: 8.5, z: 13 };
    ai.facing = Math.PI / 2;   // взгляд в -x, на игрока
    const all = buildColliders(world.level);

    // Ведём его сквозь d_hall_nursery в nursery — реальный проход дверью.
    const target = { x: 8.5, z: 17 };
    for (let i = 0; i < 8 / 0.016; i++) {
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.05) {
        const move = Math.min(3 * 0.016, distance);
        player.x += (dx / distance) * move;
        player.z += (dz / distance) * move;
      }
      ai.step(0.016, player, activeColliders(all, world.openDoors()));
    }
    expect(ai.state).toBe('chase');
    expect(world.isDoorOpen('d_hall_nursery')).toBe(true);
  });
});

describe('расстояние по графу', () => {
  it('в одной комнате равно прямой линии', () => {
    const { ai } = fresh();
    // Спавн в hall_n: (11, 13). Точка рядом, в той же комнате.
    expect(ai.distanceTo({ x: 12, z: 13 })).toBeCloseTo(1);
  });

  it('за запертой дверью — null, это и есть убежище', () => {
    const { ai } = fresh();
    // Кухня заперта медным замком; единственный вход — через него.
    expect(ai.distanceTo({ x: 13, z: 2 })).toBe(null);
  });
});
