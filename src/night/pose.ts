import { NIGHT } from '../config';
import type { Night } from '../core/night';
import type { NightDef, NightMonster, ShutterSide } from '../core/types';

export interface MonsterPose {
  x: number;
  z: number;
  /** Высота ног: на помосте — его высота. */
  y: number;
  facing: number;
}

/** Угол yaw, при котором взгляд (-sin f, -cos f) направлен из `from` в `to`. */
export function facingToward(from: readonly [number, number], to: readonly [number, number]): number {
  return Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
}

export function onStage(def: NightDef, at: readonly [number, number]): boolean {
  if (!def.stage) return false;
  const [x, z, w, d] = def.stage;
  return at[0] >= x && at[0] <= x + w && at[1] >= z && at[1] <= z + d;
}

function monster(def: NightDef, id: string): NightMonster {
  const m = def.monsters.find((x) => x.id === id);
  if (!m) throw new Error(`Монстра "${id}" нет.`);
  return m;
}

/** Где стоит и куда смотрит: на следующую точку маршрута, а у заслонки — в проём. */
export function monsterPose(
  def: NightDef,
  shutterAt: Record<ShutterSide, readonly [number, number]>,
  night: Night,
  id: string,
): MonsterPose {
  const m = monster(def, id);
  const i = night.pointIndex(id);
  const here = m.route[i]!;
  const target = i === m.route.length - 1 ? shutterAt[m.door] : m.route[i + 1]!.at;
  return {
    x: here.at[0],
    z: here.at[1],
    y: onStage(def, here.at) ? NIGHT.stageHeight : 0,
    facing: facingToward(here.at, target),
  };
}

/**
 * Правило спеки §4: стоящего в проёме видно из офиса только при свете с его
 * стороны. У вентиляции света нет — серого там видно только на камере 5.
 * Решается видимостью меша, а не освещением: лампа комнаты за дверью светит
 * и в проём, и «не видно» тогда зависело бы от яркости экрана телефона.
 */
export function visibleFromOffice(def: NightDef, night: Night, id: string): boolean {
  if (!night.atDoor(id)) return true;
  const door = monster(def, id).door;
  return door !== 'vent' && night.isLit(door);
}
