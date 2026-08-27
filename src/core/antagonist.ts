import { ANTAGONIST, DOOR } from '../config';
import { doorWaypoints, pathDistance, roomAt, roomCenter, roomPath, type Point } from './pathing';
import { canSee } from './vision';
import type { Aabb } from './colliders';
import type { AntagonistDef, DoorDef, Level } from './types';
import type { World } from './world';

export type AntagonistState = 'patrol' | 'chase' | 'search';

/** Точка маршрута. `door` — дверь, к которой она относится; `closing` — вторая из пары. */
interface Step extends Point { door?: string; closing?: boolean }

export class Antagonist {
  x: number;
  z: number;
  /** Радианы по соглашению yaw игрока: взгляд направлен в (-sin, -cos). */
  facing = 0;
  state: AntagonistState = 'patrol';
  seesPlayer = false;

  private readonly def: AntagonistDef;
  private queue: Step[] = [];
  private routeIndex = 0;
  private waitLeft = 0;
  /** Последняя точка, где его видели. Заморожена, пока не увидит снова. */
  private lastSeen: Point | null = null;
  private searchLeft = 0;
  /**
   * Комната цели преследования, для которой построена текущая очередь — чтобы
   * не пересчитывать BFS каждый кадр, а только когда игрок сменил комнату.
   * `undefined` — план не строился (или стал недействителен и должен быть
   * перестроен); `null` — валидное значение `roomAt()`, цель не в комнате.
   */
  private pursuitRoom: string | null | undefined = undefined;

  constructor(private readonly level: Level, private readonly world: World) {
    const def = level.antagonist;
    if (!def) throw new Error('В уровне нет блока antagonist.');
    this.def = def;
    this.x = def.spawn.x;
    this.z = def.spawn.z;
  }

  /** Запертая дверь для него стена: замки — головоломка игрока. */
  private passable = (door: DoorDef): boolean =>
    door.lock === undefined || this.world.isDestroyed(door.lock);

  step(dt: number, player: Point, boxes: readonly Aabb[]): void {
    if (this.waitLeft > 0) { this.waitLeft -= dt; return; }

    this.seesPlayer = canSee(
      { x: this.x, z: this.z }, this.facing, player, boxes, ANTAGONIST.sight, ANTAGONIST.fov);

    if (this.seesPlayer) {
      // Старый план сбрасывается, только если он был патрульным — у ПОГОНИ и
      // ПОИСКА общая цель (lastSeen), и план между ними общий тоже. Сбрасывать
      // его при любом возврате из ПОИСКА нельзя: ровно в проёме двери зрение
      // мигает кадр через кадр, и пересборка каждый раз с первой путевой точки
      // (она уже позади) раскачивала бы его взад-вперёд на пороге бесконечно.
      if (this.state === 'patrol') {
        this.queue = [];
        this.pursuitRoom = undefined;
      }
      this.state = 'chase';
      this.lastSeen = { ...player };
      this.searchLeft = ANTAGONIST.searchSeconds;
    } else if (this.state === 'chase') {
      this.state = 'search';
    } else if (this.state === 'search') {
      this.searchLeft -= dt;
      if (this.searchLeft <= 0) {
        const from = roomAt(this.level, { x: this.x, z: this.z }) ?? this.def.spawn.room;
        this.routeIndex = this.nearestRouteIndex(from);
        this.state = 'patrol';
        this.pursuitRoom = undefined;
        this.queue = [];
      }
    }

    if (this.state === 'chase' || this.state === 'search') {
      this.pursueLastSeen();
      if (this.state === 'search' && this.queue.length === 0) {
        // Дошёл, искать больше некуда — осматривается на месте.
        this.facing += dt;
        return;
      }
    } else if (this.queue.length === 0) {
      this.planPatrol();
    }

    this.advance(dt);
  }

  /**
   * Ведёт к `lastSeen`. В ПОГОНЕ цель жива и в одной с ним комнате обновляется
   * каждый кадр напрямую, без BFS. В ПОИСКЕ цель заморожена: план (прямая точка
   * или путевые точки через комнаты) строится один раз и не трогается, пока не
   * закончится — иначе очередь никогда не опустеет и осмотр на месте не наступит.
   * Путь между комнатами в обоих случаях пересчитывается только когда сменилась
   * комната цели, а не каждый кадр.
   */
  private pursueLastSeen(): void {
    const target = this.lastSeen;
    if (!target) { this.queue = []; return; }

    const from = roomAt(this.level, { x: this.x, z: this.z });
    const to = roomAt(this.level, target);

    if (this.state === 'chase' && from !== null && from === to) {
      this.queue = [{ ...target }];
      return;
    }
    if (to === this.pursuitRoom) return;   // план на эту цель уже построен
    this.pursuitRoom = to;

    if (from === null || to === null) { this.queue = []; return; }
    if (from === to) {
      this.queue = [{ ...target }];
      return;
    }

    const chain = roomPath(this.level, from, to, this.passable);
    if (chain === null) {
      // Игрок ушёл за дверь, которую он открыть не может. Дальше идти
      // некуда — это и есть механика убежища из спеки §7.
      this.state = 'search';
      this.queue = [];
      return;
    }
    const steps = this.pointsAlong(chain);
    steps.push({ ...target });
    this.queue = steps;
  }

  /** Индекс комнаты обхода, до которой сейчас короче всего дойти по графу. */
  private nearestRouteIndex(from: string): number {
    let bestIndex = this.routeIndex;
    let bestLength = Infinity;
    this.def.route.forEach((target, index) => {
      const chain = roomPath(this.level, from, target, this.passable);
      if (chain !== null && chain.length < bestLength) {
        bestLength = chain.length;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  private planPatrol(): void {
    const from = roomAt(this.level, { x: this.x, z: this.z });
    if (from === null || this.def.route.length === 0) return;

    // Недостижимая сейчас комната обхода пропускается: снятый игроком замок
    // вернёт её в цикл сам. Перебор ограничен длиной обхода — если недостижимы
    // все, он стоит, и это ловит правило 7 валидатора у автора карты.
    for (let tried = 0; tried < this.def.route.length; tried++) {
      const target = this.def.route[this.routeIndex % this.def.route.length]!;
      this.routeIndex = (this.routeIndex + 1) % this.def.route.length;
      const chain = roomPath(this.level, from, target, this.passable);
      if (chain === null) continue;
      const steps = this.pointsAlong(chain);
      const room = this.level.rooms.find((r) => r.id === target);
      if (room) steps.push(roomCenter(room));
      if (steps.length > 0) { this.queue = steps; return; }
    }
  }

  /** Пара точек на каждую дверь цепочки: подход с этой стороны и выход с той. */
  private pointsAlong(chain: string[]): Step[] {
    const steps: Step[] = [];
    for (let i = 1; i < chain.length; i++) {
      const from = chain[i - 1]!;
      const to = chain[i]!;
      const door = this.level.doors.find(
        (d) => d.between.includes(from) && d.between.includes(to));
      if (!door) continue;
      const [near, far] = doorWaypoints(this.level, door, from);
      steps.push({ ...near, door: door.id });
      steps.push({ ...far, door: door.id, closing: true });
    }
    return steps;
  }

  private advance(dt: number): void {
    const target = this.queue[0];
    if (!target) return;

    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1e-6) this.facing = Math.atan2(-dx, -dz);

    const move = ANTAGONIST.speed * dt;
    if (distance > move) {
      this.x += (dx / distance) * move;
      this.z += (dz / distance) * move;
      return;
    }

    this.x = target.x;
    this.z = target.z;
    this.queue.shift();
    this.arrive(target);
  }

  private arrive(step: Step): void {
    if (step.door === undefined) return;

    if (!step.closing) {
      // Подошёл к двери. Закрытую надо открыть и дождаться створки — иначе он
      // пройдёт сквозь полотно на глазах у игрока.
      if (!this.world.isDoorOpen(step.door)) {
        this.world.applyEffects([{ kind: 'toggleDoor', door: step.door }]);
        this.waitLeft = DOOR.openSeconds;
      }
      return;
    }

    // Вышел с другой стороны — закрывает за собой, но только в ПАТРУЛЕ. В
    // ПОГОНЕ и ПОИСКЕ — нет: закрытая им дверь на маршруте побега съедает
    // отрыв, накопленный за три секунды бега. Кроме дверей из keepOpen:
    // закрытая им дверь кольца рвёт круг, который для того и рисовался.
    if (this.state !== 'patrol') return;
    if (this.def.keepOpen.includes(step.door)) return;
    if (this.world.isDoorOpen(step.door)) {
      this.world.applyEffects([{ kind: 'toggleDoor', door: step.door }]);
    }
  }

  caught(player: Point): boolean {
    if (!this.seesPlayer) return false;
    return Math.hypot(player.x - this.x, player.z - this.z) <= ANTAGONIST.catchDistance;
  }

  /** Расстояние по графу комнат — виньетке прямая линия соврала бы сквозь стену. */
  distanceTo(player: Point): number | null {
    return pathDistance(this.level, { x: this.x, z: this.z }, player, this.passable);
  }
}
