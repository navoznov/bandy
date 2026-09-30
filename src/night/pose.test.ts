import { describe, expect, it } from 'vitest';
import { NIGHT } from '../config';
import { Night } from '../core/night';
import type { NightDef } from '../core/types';
import { facingToward, monsterPose, onStage, visibleFromOffice } from './pose';

const def: NightDef = {
  office: 'office',
  shutters: { left: 'dl', vent: 'dv', right: 'dr' },
  stage: [0, 0, 4, 2],
  cameras: [{ id: '1', room: 'hall', at: [1, 1], look: [2, 2] }],
  monsters: [
    { id: 'red', color: '#c0302a', aggression: 20, door: 'right',
      route: [{ room: 'hall', at: [1, 1] }, { room: 'east', at: [5, 5] }] },
    { id: 'grey', color: '#9a9a9e', aggression: 20, door: 'vent',
      route: [{ room: 'hall', at: [3, 3] }, { room: 'vent', at: [6, 6] }] },
  ],
};
const shutterAt = { left: [0, 8], vent: [6, 8], right: [5, 8] } as const;

describe('facingToward', () => {
  // Соглашение yaw: взгляд в (-sin f, -cos f).
  it('на −z — ноль', () => expect(facingToward([0, 0], [0, -1])).toBeCloseTo(0));
  it('на −x — плюс π/2', () => expect(facingToward([0, 0], [-1, 0])).toBeCloseTo(Math.PI / 2));
  it('на +x — минус π/2', () => expect(facingToward([0, 0], [1, 0])).toBeCloseTo(-Math.PI / 2));
});

describe('onStage', () => {
  it('точка внутри помоста', () => expect(onStage(def, [1, 1])).toBe(true));
  it('точка вне помоста', () => expect(onStage(def, [5, 5])).toBe(false));
  it('уровень без помоста', () => expect(onStage({ ...def, stage: undefined }, [1, 1])).toBe(false));
});

describe('monsterPose', () => {
  it('на сцене стоит на помосте и смотрит на следующую точку', () => {
    const night = new Night(def, () => 0.999);
    const pose = monsterPose(def, shutterAt, night, 'red');
    expect(pose.y).toBe(NIGHT.stageHeight);
    expect(pose.facing).toBeCloseTo(facingToward([1, 1], [5, 5]));
  });

  it('у заслонки стоит на полу и смотрит в проём', () => {
    const night = new Night(def, () => 0);
    night.step(5);
    const pose = monsterPose(def, shutterAt, night, 'red');
    expect(pose.y).toBe(0);
    expect(pose.facing).toBeCloseTo(facingToward([5, 5], [5, 8]));
  });
});

describe('visibleFromOffice', () => {
  it('в пути не виден из офиса, даже при обоих светах', () => {
    const night = new Night(def, () => 0.999);
    expect(visibleFromOffice(def, night, 'red')).toBe(false);
    night.toggleLight('left');
    night.toggleLight('right');
    expect(visibleFromOffice(def, night, 'red')).toBe(false);
    expect(visibleFromOffice(def, night, 'grey')).toBe(false);
  });

  it('у двери — только при свете с её стороны', () => {
    const night = new Night(def, () => 0);
    night.step(5);
    expect(visibleFromOffice(def, night, 'red')).toBe(false);
    night.toggleLight('left');
    expect(visibleFromOffice(def, night, 'red')).toBe(false);
    night.toggleLight('right');
    expect(visibleFromOffice(def, night, 'red')).toBe(true);
  });

  it('у вентиляции не виден никогда — света там нет', () => {
    const night = new Night(def, () => 0);
    night.step(5);
    night.toggleLight('left');
    night.toggleLight('right');
    expect(visibleFromOffice(def, night, 'grey')).toBe(false);
  });
});
