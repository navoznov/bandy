import { describe, expect, it } from 'vitest';
import { NIGHT } from '../config';
import { Night, type NightEvent } from './night';
import type { NightDef, NightMonster } from './types';

/** При aggression > 0 любой бросок успешен. */
const HIT = (): number => 0;
/** При aggression < 20 ни один бросок не успешен. */
const MISS = (): number => 0.999;

function monster(over: Partial<NightMonster> = {}): NightMonster {
  return {
    id: 'red', color: '#c0302a', aggression: 20, door: 'right',
    route: [{ room: 'hall', at: [1, 1] }, { room: 'side', at: [2, 2] }],
    ...over,
  };
}

function def(monsters: NightMonster[] = [monster()]): NightDef {
  return {
    office: 'office',
    shutters: { left: 'dl', vent: 'dv', right: 'dr' },
    cameras: [
      { id: '1', room: 'hall', at: [1, 1], look: [2, 2] },
      { id: '2', room: 'side', at: [1, 1], look: [2, 2] },
      { id: '3', room: 'other', at: [1, 1], look: [2, 2] },
    ],
    monsters,
  };
}

function record(night: Night): NightEvent[] {
  const events: NightEvent[] = [];
  night.on((event) => events.push(event));
  return events;
}

const calm = (): Night => new Night(def([monster({ aggression: 0 })]), MISS);

describe('часы', () => {
  it('6 AM ровно через 360 с, и победа сообщается один раз', () => {
    const night = calm();
    const events = record(night);
    for (let i = 0; i < 359; i++) night.step(1);
    expect(night.status).toBe('running');
    expect(night.hour).toBe(5);
    night.step(1);
    night.step(1);
    expect(night.status).toBe('won');
    expect(events.filter((e) => e.kind === 'won')).toHaveLength(1);
  });

  it('час считается от начала ночи: 125 с — это 2 AM', () => {
    const night = calm();
    night.step(125);
    expect(night.hour).toBe(2);
  });
});

describe('энергия', () => {
  it('в покое горит одна полоска: 0.1 % в секунду', () => {
    const night = calm();
    night.step(10);
    expect(night.bars()).toBe(1);
    expect(night.power).toBeCloseTo(99);
  });

  it('заслонка, свет и монитор — по полоске каждый', () => {
    const night = calm();
    night.toggleShutter('left');
    night.toggleLight('right');
    night.toggleMonitor(); // гасит свет: поднятие монитора выключает оба фонаря
    expect(night.bars()).toBe(3);
    night.toggleMonitor();
    night.toggleLight('right');
    night.toggleShutter('vent');
    expect(night.bars()).toBe(4);
    night.step(10);
    expect(night.power).toBeCloseTo(96);
  });
});

describe('монитор', () => {
  it('пока поднят, заслонки и свет не нажимаются и энергию не тратят', () => {
    const night = calm();
    night.toggleMonitor();
    expect(night.toggleShutter('left')).toBe(false);
    expect(night.toggleLight('left')).toBe(false);
    expect(night.isClosed('left')).toBe(false);
    expect(night.isLit('left')).toBe(false);
    expect(night.bars()).toBe(2);
  });

  it('поднятие монитора гасит свет', () => {
    const night = calm();
    night.toggleLight('left');
    night.toggleMonitor();
    expect(night.isLit('left')).toBe(false);
  });

  it('неизвестную камеру выбрать нельзя', () => {
    const night = calm();
    expect(night.selectCamera('9')).toBe(false);
    expect(night.camera).toBe('1');
    expect(night.selectCamera('2')).toBe(true);
    expect(night.camera).toBe('2');
  });
});

describe('монстры', () => {
  it('прыгают раз в 5 секунд при удачном броске', () => {
    const night = new Night(def(), HIT);
    const events = record(night);
    night.step(4);
    expect(night.pointIndex('red')).toBe(0);
    night.step(1);
    expect(night.pointOf('red').room).toBe('side');
    expect(night.atDoor('red')).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'moved', monster: 'red' }));
  });

  it('при неудачном броске стоят', () => {
    const night = new Night(def([monster({ aggression: 10 })]), MISS);
    night.step(60);
    expect(night.pointIndex('red')).toBe(0);
  });

  // Review Focus 2: вкладка вернулась из фона, кадр принёс больше одного периода.
  it('большой шаг делает все положенные броски, а не один', () => {
    const route = [
      { room: 'hall', at: [1, 1] as const },
      { room: 'hall', at: [2, 2] as const },
      { room: 'side', at: [3, 3] as const },
    ];
    const night = new Night(def([monster({ route })]), HIT);
    night.step(10);
    expect(night.pointIndex('red')).toBe(2);
  });

  it('у закрытой заслонки уходит на старт', () => {
    const night = new Night(def(), HIT);
    const events = record(night);
    night.step(5);
    night.toggleShutter('right');
    night.step(5);
    expect(night.status).toBe('running');
    expect(night.pointIndex('red')).toBe(0);
    expect(events).toContainEqual({ kind: 'repelled', monster: 'red', side: 'right' });
  });

  it('у открытой заслонки ловит, и после этого время стоит', () => {
    const night = new Night(def(), HIT);
    const events = record(night);
    night.step(5);
    night.step(5);
    expect(night.status).toBe('caught');
    expect(events).toContainEqual({ kind: 'caught', monster: 'red' });
    const frozen = night.time;
    night.step(5);
    expect(night.time).toBe(frozen);
  });

  it('закрытая заслонка с другой стороны не спасает', () => {
    const night = new Night(def(), HIT);
    night.step(5);
    night.toggleShutter('left');
    night.step(5);
    expect(night.status).toBe('caught');
  });

  // Review Focus 5: красный и оранжевый приходят к одной двери.
  it('два монстра у одной закрытой заслонки отражаются оба', () => {
    const night = new Night(def([monster(), monster({ id: 'orange' })]), HIT);
    night.step(5);
    night.toggleShutter('right');
    night.step(5);
    expect(night.status).toBe('running');
    expect(night.pointIndex('red')).toBe(0);
    expect(night.pointIndex('orange')).toBe(0);
  });
});

describe('конец энергии', () => {
  const hungry = { ...NIGHT, drainPerBar: 100 };

  it('заслонки открываются, монитор падает, кнопки мертвы, затем поимка первым монстром', () => {
    const night = new Night(def([monster(), monster({ id: 'orange' })]), HIT, hungry);
    const events = record(night);
    night.toggleShutter('left');
    night.toggleMonitor();
    night.step(1);
    expect(night.status).toBe('blackout');
    expect(events).toContainEqual({ kind: 'blackout' });
    expect(night.isClosed('left')).toBe(false);
    expect(night.monitorUp).toBe(false);
    expect(night.toggleShutter('left')).toBe(false);
    expect(night.toggleMonitor()).toBe(false);
    expect(night.bars()).toBe(0);

    // HIT = 0 → затемнение длится ровно blackoutMin = 5 с. Монстры в нём не ходят.
    night.step(4.9);
    expect(night.status).toBe('blackout');
    expect(night.pointIndex('red')).toBe(0);
    night.step(0.2);
    expect(night.status).toBe('caught');
    expect(events).toContainEqual({ kind: 'caught', monster: 'red' });
  });

  it('6 AM посреди затемнения спасает', () => {
    const night = new Night(def(), () => 0.5, { ...hungry, hourSeconds: 1 });
    night.step(1);
    expect(night.status).toBe('blackout');
    for (let i = 0; i < 5; i++) night.step(1);
    expect(night.status).toBe('won');
  });
});

describe('помехи на камере', () => {
  it('монстр вошёл в смотримую комнату', () => {
    const night = new Night(def(), HIT);
    night.toggleMonitor();
    night.selectCamera('2');
    night.step(5);
    expect(night.staticLeft).toBeCloseTo(1);
    night.step(0.5);
    expect(night.staticLeft).toBeCloseTo(0.5);
  });

  it('монстр вышел из смотримой комнаты', () => {
    const night = new Night(def(), HIT);
    night.toggleMonitor();
    night.step(5);
    expect(night.staticLeft).toBeCloseTo(1);
  });

  it('не задело смотримую комнату — помех нет', () => {
    const night = new Night(def(), HIT);
    night.toggleMonitor();
    night.selectCamera('3');
    night.step(5);
    expect(night.staticLeft).toBe(0);
  });

  it('монитор опущен — помех нет', () => {
    const night = new Night(def(), HIT);
    night.step(5);
    expect(night.staticLeft).toBe(0);
  });
});
