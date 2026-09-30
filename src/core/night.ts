import { NIGHT } from '../config';
import type { NightDef, NightMonster, RoutePoint, ShutterSide } from './types';

export type LightSide = 'left' | 'right';
export type NightStatus = 'running' | 'blackout' | 'caught' | 'won';

export type NightEvent =
  | { kind: 'moved'; monster: string; from: RoutePoint; to: RoutePoint }
  | { kind: 'repelled'; monster: string; side: ShutterSide }
  | { kind: 'blackout' }
  | { kind: 'caught'; monster: string }
  | { kind: 'won' };

/** Числа, от которых зависит ход ночи. По умолчанию — `NIGHT`; тесты подставляют свои. */
export interface NightTuning {
  hourSeconds: number;
  hours: number;
  drainPerBar: number;
  opportunitySeconds: number;
  blackoutMin: number;
  blackoutMax: number;
  staticSeconds: number;
}

/**
 * Ночь целиком, без единого меша: часы, энергия, заслонки, свет, монитор и
 * монстры. Случайность подаётся снаружи, поэтому любой ход ночи воспроизводим
 * в тестах. Рендер и HUD только читают состояние и зовут `toggle*`.
 */
export class Night {
  time = 0;
  power = 100;
  status: NightStatus = 'running';
  monitorUp = false;
  /** Камера, выбранная на мониторе. Выбор переживает опускание монитора. */
  camera: string;

  private readonly closed = new Set<ShutterSide>();
  private readonly lit = new Set<LightSide>();
  private readonly index = new Map<string, number>();
  private readonly listeners: Array<(event: NightEvent) => void> = [];
  private sinceRoll = 0;
  private blackoutLeft = 0;
  private staticRemaining = 0;

  constructor(
    private readonly def: NightDef,
    private readonly rng: () => number,
    private readonly tuning: NightTuning = NIGHT,
  ) {
    const first = def.cameras[0];
    if (!first) throw new Error('Ночь без камер: валидатор должен был это поймать.');
    this.camera = first.id;
    for (const m of def.monsters) this.index.set(m.id, 0);
  }

  on(listener: (event: NightEvent) => void): void {
    this.listeners.push(listener);
  }

  /** 0 — это 12 AM, 6 — это 6 AM. */
  get hour(): number {
    return Math.min(this.tuning.hours, Math.floor(this.time / this.tuning.hourSeconds));
  }

  /** Сколько секунд ещё идут помехи на камере монитора. */
  get staticLeft(): number {
    return this.staticRemaining;
  }

  /** Полоски расхода. Одна горит всегда; после конца энергии не горит ничего. */
  bars(): number {
    if (this.status !== 'running') return 0;
    return 1 + this.closed.size + this.lit.size + (this.monitorUp ? 1 : 0);
  }

  isClosed(side: ShutterSide): boolean {
    return this.closed.has(side);
  }

  isLit(side: LightSide): boolean {
    return this.lit.has(side);
  }

  pointIndex(id: string): number {
    const i = this.index.get(id);
    if (i === undefined) throw new Error(`Монстра "${id}" нет.`);
    return i;
  }

  pointOf(id: string): RoutePoint {
    return this.monster(id).route[this.pointIndex(id)]!;
  }

  /** Стоит у своей заслонки и ждёт следующего броска. */
  atDoor(id: string): boolean {
    return this.pointIndex(id) === this.monster(id).route.length - 1;
  }

  /** false — нажатие отвергнуто: поднят монитор, нет энергии или ночь кончилась. */
  toggleShutter(side: ShutterSide): boolean {
    if (this.status !== 'running' || this.monitorUp) return false;
    if (!this.closed.delete(side)) this.closed.add(side);
    return true;
  }

  toggleLight(side: LightSide): boolean {
    if (this.status !== 'running' || this.monitorUp) return false;
    if (!this.lit.delete(side)) this.lit.add(side);
    return true;
  }

  toggleMonitor(): boolean {
    if (this.status !== 'running') return false;
    this.monitorUp = !this.monitorUp;
    // Свет в проёме, пока смотришь в планшет, — энергия, потраченная ни на что.
    if (this.monitorUp) this.lit.clear();
    return true;
  }

  selectCamera(id: string): boolean {
    if (!this.def.cameras.some((c) => c.id === id)) return false;
    this.camera = id;
    return true;
  }

  step(dt: number): void {
    if (this.status === 'caught' || this.status === 'won') return;
    this.time += dt;
    this.staticRemaining = Math.max(0, this.staticRemaining - dt);

    // Победа проверяется первой: 6 AM посреди затемнения спасает.
    if (this.time >= this.tuning.hours * this.tuning.hourSeconds) {
      this.status = 'won';
      this.emit({ kind: 'won' });
      return;
    }

    if (this.status === 'blackout') {
      this.blackoutLeft -= dt;
      if (this.blackoutLeft <= 0) this.catchBy(this.def.monsters[0]!.id);
      return;
    }

    this.power = Math.max(0, this.power - this.bars() * this.tuning.drainPerBar * dt);
    if (this.power <= 0) {
      this.startBlackout();
      return;
    }

    // `while`, а не `if`: кадр после возврата вкладки может принести больше
    // одного периода, и броски за него не должны пропадать.
    this.sinceRoll += dt;
    while (this.sinceRoll >= this.tuning.opportunitySeconds && this.status === 'running') {
      this.sinceRoll -= this.tuning.opportunitySeconds;
      this.roll();
    }
  }

  private monster(id: string): NightMonster {
    const m = this.def.monsters.find((x) => x.id === id);
    if (!m) throw new Error(`Монстра "${id}" нет.`);
    return m;
  }

  private emit(event: NightEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private startBlackout(): void {
    this.status = 'blackout';
    this.closed.clear();
    this.lit.clear();
    this.monitorUp = false;
    const { blackoutMin, blackoutMax } = this.tuning;
    this.blackoutLeft = blackoutMin + this.rng() * (blackoutMax - blackoutMin);
    this.emit({ kind: 'blackout' });
  }

  private roll(): void {
    for (const m of this.def.monsters) {
      if (this.rng() >= m.aggression / 20) continue;
      const i = this.pointIndex(m.id);
      const from = m.route[i]!;
      if (i < m.route.length - 1) {
        this.index.set(m.id, i + 1);
        this.moved(m.id, from, m.route[i + 1]!);
        continue;
      }
      // Стоял у заслонки. Закрыта в этот момент — на старт; открыта — вошёл.
      if (!this.closed.has(m.door)) {
        this.catchBy(m.id);
        return;
      }
      this.index.set(m.id, 0);
      this.emit({ kind: 'repelled', monster: m.id, side: m.door });
      this.moved(m.id, from, m.route[0]!);
    }
  }

  private moved(id: string, from: RoutePoint, to: RoutePoint): void {
    if (this.monitorUp) {
      const room = this.def.cameras.find((c) => c.id === this.camera)?.room;
      if (from.room === room || to.room === room) this.staticRemaining = this.tuning.staticSeconds;
    }
    this.emit({ kind: 'moved', monster: id, from, to });
  }

  private catchBy(id: string): void {
    this.status = 'caught';
    this.emit({ kind: 'caught', monster: id });
  }
}
