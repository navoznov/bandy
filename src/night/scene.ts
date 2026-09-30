import * as THREE from 'three';
import { DOOR, NIGHT, ROOM } from '../config';
import type { Night } from '../core/night';
import type { Level, NightDef, RoomDef, ShutterSide } from '../core/types';
import { SHUTTER_SIDES } from '../core/types';
import { doorOnVerticalWall, roomBounds } from '../core/validate';
import { createAntagonistMesh } from '../render/antagonist';
import { monsterPose, visibleFromOffice } from './pose';

function officeOf(level: Level, def: NightDef): RoomDef {
  const office = level.rooms.find((r) => r.id === def.office);
  if (!office) throw new Error(`Офиса "${def.office}" нет.`);
  return office;
}

function shutterDoor(level: Level, def: NightDef, side: ShutterSide) {
  const door = level.doors.find((d) => d.id === def.shutters[side]);
  if (!door) throw new Error(`Двери заслонки "${side}" нет.`);
  return door;
}

export function shutterPoints(level: Level, def: NightDef): Record<ShutterSide, readonly [number, number]> {
  return {
    left: shutterDoor(level, def, 'left').at,
    vent: shutterDoor(level, def, 'vent').at,
    right: shutterDoor(level, def, 'right').at,
  };
}

const SHUTTER_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 0.6, metalness: 0.5 });
const SHUTTER_GEOMETRY = new THREE.BoxGeometry(DOOR.width + 0.1, DOOR.height, 0.08);

export interface Shutters {
  group: THREE.Group;
  update(dt: number, closed: (side: ShutterSide) => boolean): void;
}

/**
 * Шторка стоит ровно на линии стыка комнат. Открытая уходит вверх на свою
 * высоту — в толщу перемычки и выше потолка, откуда её не видно ни из офиса,
 * ни с камер: стены строятся внутрь комнат, и на стыке их две.
 */
export function buildShutters(level: Level, def: NightDef): Shutters {
  const group = new THREE.Group();
  const office = officeOf(level, def);
  const panels = new Map<ShutterSide, { mesh: THREE.Mesh; t: number }>();
  for (const side of SHUTTER_SIDES) {
    const door = shutterDoor(level, def, side);
    const mesh = new THREE.Mesh(SHUTTER_GEOMETRY, SHUTTER_MATERIAL);
    mesh.position.set(door.at[0], DOOR.height * 1.5, door.at[1]);
    if (doorOnVerticalWall(door, office)) mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
    panels.set(side, { mesh, t: 0 });
  }
  return {
    group,
    update(dt, closed) {
      const step = dt / NIGHT.shutterSeconds;
      for (const [side, panel] of panels) {
        panel.t = closed(side) ? Math.min(1, panel.t + step) : Math.max(0, panel.t - step);
        panel.mesh.position.y = DOOR.height * (1.5 - panel.t);
      }
    },
  };
}

export interface DoorLights {
  group: THREE.Group;
  update(lit: (side: 'left' | 'right') => boolean): void;
}

/** Лампа — на метр за проёмом, в соседней комнате: светит на того, кто стоит в проёме. */
export function buildDoorLights(level: Level, def: NightDef): DoorLights {
  const group = new THREE.Group();
  const office = officeOf(level, def);
  const b = roomBounds(office);
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const lamps = new Map<'left' | 'right', THREE.PointLight>();
  for (const side of ['left', 'right'] as const) {
    const door = shutterDoor(level, def, side);
    const vertical = doorOnVerticalWall(door, office);
    const lamp = new THREE.PointLight(0xfff0cc, 0, 4, 2);
    lamp.position.set(
      door.at[0] + (vertical ? Math.sign(door.at[0] - cx) : 0),
      2.0,
      door.at[1] + (vertical ? 0 : Math.sign(door.at[1] - cz)),
    );
    group.add(lamp);
    lamps.set(side, lamp);
  }
  return {
    group,
    // Меняется только яркость, число источников постоянно — шейдеры не пересобираются.
    update(lit) {
      for (const [side, lamp] of lamps) lamp.intensity = lit(side) ? 6 : 0;
    },
  };
}

/** Помост сцены и стол в офисе, правее вентиляции. */
export function buildProps(level: Level, def: NightDef): THREE.Group {
  const group = new THREE.Group();
  if (def.stage) {
    const [x, z, w, d] = def.stage;
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(w, NIGHT.stageHeight, d),
      new THREE.MeshStandardMaterial({ color: 0x4a2f2a, roughness: 0.8 }),
    );
    stage.position.set(x + w / 2, NIGHT.stageHeight / 2, z + d / 2);
    group.add(stage);
  }
  const b = roomBounds(officeOf(level, def));
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.75, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.7 }),
  );
  desk.position.set((b.x0 + b.x1) / 2 + 1.2, 0.375, b.z0 + ROOM.wallThickness + 0.35);
  group.add(desk);
  return group;
}

const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
const EYE_GEOMETRY = new THREE.SphereGeometry(0.035, 10, 8);

/** Меш антагониста своего цвета плюс два светящихся глаза — чтобы в скримере было лицо. */
export function createMonsterMesh(color: string): ReturnType<typeof createAntagonistMesh> {
  const emissive = `#${new THREE.Color(color).multiplyScalar(0.35).getHexString()}`;
  const mesh = createAntagonistMesh({ color, emissive });
  for (const sx of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(EYE_GEOMETRY, EYE_MATERIAL);
    // Голова — куб 0.32 с центром на 1.5 м; «вперёд» у меша — −Z.
    eye.position.set(sx, 1.53, -0.165);
    mesh.group.add(eye);
  }
  return mesh;
}

export interface MonsterMeshes {
  group: THREE.Group;
  /** `office` — действует правило видимости в проёме; `feed` — камера видит всех. */
  update(night: Night, view: 'office' | 'feed'): void;
}

export function buildMonsters(
  def: NightDef,
  shutterAt: Record<ShutterSide, readonly [number, number]>,
): MonsterMeshes {
  const group = new THREE.Group();
  const meshes = def.monsters.map((m) => {
    const mesh = createMonsterMesh(m.color);
    group.add(mesh.group);
    return { id: m.id, mesh };
  });
  return {
    group,
    update(night, view) {
      for (const { id, mesh } of meshes) {
        const pose = monsterPose(def, shutterAt, night, id);
        mesh.update(pose.x, pose.z, pose.facing);
        mesh.group.position.y = pose.y;
        mesh.group.visible = view === 'feed' || visibleFromOffice(def, night, id);
      }
    },
  };
}
