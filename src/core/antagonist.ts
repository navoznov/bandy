import { ANTAGONIST, DOOR } from '../config';
import { doorWaypoints, roomAt, roomCenter, roomPath, type Point } from './pathing';
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

  step(dt: number, _player: Point, _boxes: readonly Aabb[]): void {
    if (this.waitLeft > 0) { this.waitLeft -= dt; return; }
    if (this.queue.length === 0) this.planPatrol();
    this.advance(dt);
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

    // Вышел с другой стороны — закрывает за собой. Кроме дверей из keepOpen:
    // закрытая им дверь кольца съедает отрыв, накопленный за три секунды бега.
    if (this.def.keepOpen.includes(step.door)) return;
    if (this.world.isDoorOpen(step.door)) {
      this.world.applyEffects([{ kind: 'toggleDoor', door: step.door }]);
    }
  }

  /** Пока зрения нет (Task 6), ловли нет тоже. */
  caught(_player: Point): boolean {
    return false;
  }
}
