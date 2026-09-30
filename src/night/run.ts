import * as THREE from 'three';
import { MAX_DELTA_SECONDS, NIGHT, PLAYER } from '../config';
import { Night } from '../core/night';
import type { NightDef } from '../core/types';
import { World } from '../core/world';
import type { RunContext } from '../context';
import { buildScene } from '../render/scene';
import { showFatal } from '../ui/fatal';
import { buildDoorLights, buildMonsters, buildProps, buildShutters, shutterPoints } from './scene';

/** Лёгкий наклон взгляда вниз: из-за стола видно пол в проёмах. */
const OFFICE_PITCH = -0.05;

export function runNight(ctx: RunContext, def: NightDef): void {
  const { level, renderer } = ctx;

  // `World` нужен только построителю сцены: ночью двери никто не открывает.
  const world = new World(level);
  const { scene } = buildScene(level, world, { doorLeaves: false, ambient: NIGHT.ambient });

  const night = new Night(def, Math.random);
  const shutterAt = shutterPoints(level, def);
  const shutters = buildShutters(level, def);
  const doorLights = buildDoorLights(level, def);
  const monsters = buildMonsters(def, shutterAt);
  scene.add(shutters.group, doorLights.group, monsters.group, buildProps(level, def));

  const officeCamera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
  officeCamera.rotation.order = 'YXZ';
  officeCamera.position.set(level.spawn.x, PLAYER.eyeHeight, level.spawn.z);
  let yaw = level.spawn.yaw;

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    officeCamera.aspect = width / height;
    officeCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let previous = performance.now();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) previous = performance.now();
  });

  renderer.setAnimationLoop((now) => {
    if (ctx.isStopped()) return;
    try {
      const dt = Math.min((now - previous) / 1000, MAX_DELTA_SECONDS);
      previous = now;

      night.step(dt);

      shutters.update(dt, (side) => night.isClosed(side));
      doorLights.update((side) => night.isLit(side));
      monsters.update(night, 'office');
      officeCamera.rotation.set(OFFICE_PITCH, yaw, 0);
      renderer.render(scene, officeCamera);
    } catch (error) {
      // Без остановки цикла браузер получит шестьдесят ошибок в секунду.
      renderer.setAnimationLoop(null);
      showFatal('Ошибка в игровом цикле', [
        error instanceof Error ? error.message : String(error),
        error instanceof Error && error.stack ? error.stack : '',
      ]);
    }
  });
}
