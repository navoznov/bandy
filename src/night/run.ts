import * as THREE from 'three';
import { MAX_DELTA_SECONDS, NIGHT, PLAYER } from '../config';
import { Night } from '../core/night';
import type { NightDef } from '../core/types';
import { World } from '../core/world';
import type { RunContext } from '../context';
import { isCoarsePointer } from '../input';
import { buildScene } from '../render/scene';
import { showFatal } from '../ui/fatal';
import { createNightHud } from './hud';
import { createMonitor } from './monitor';
import { clampYaw, createNightInput, nightTicks, type NightAction } from './input';
import { createNightStart } from './start';
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

  const act = (action: NightAction): void => {
    switch (action) {
      case 'doorLeft': night.toggleShutter('left'); break;
      case 'doorRight': night.toggleShutter('right'); break;
      case 'vent': night.toggleShutter('vent'); break;
      case 'lightLeft': night.toggleLight('left'); break;
      case 'lightRight': night.toggleLight('right'); break;
      case 'monitor': night.toggleMonitor(); break;
    }
  };
  const input = createNightInput(ctx.canvas);
  input.onAction(act);
  const hud = createNightHud(act);
  const start = createNightStart(isCoarsePointer(), () => {});
  hud.show();
  const monitor = createMonitor(level, def, (id) => night.selectCamera(id));
  const feedCamera = new THREE.PerspectiveCamera(75, 1, 0.05, 60);

  // «Поверни телефон» уже есть в разметке и показывается CSS только в портрете
  // на тач-экране; здесь его лишь разрешаем, как делает тач-схема исследования.
  if (isCoarsePointer()) document.querySelector('#rotate')?.removeAttribute('hidden');
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    officeCamera.aspect = width / height;
    officeCamera.updateProjectionMatrix();
    feedCamera.aspect = width / height;
    feedCamera.updateProjectionMatrix();
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

      if (nightTicks(start.isVisible(), portrait.matches)) {
        night.step(dt);
        yaw = clampYaw(yaw + input.takeYaw(dt), level.spawn.yaw);
      } else {
        input.takeYaw(dt); // накопленное за паузу не должно дёрнуть голову после неё
      }
      hud.update(night);

      shutters.update(dt, (side) => night.isClosed(side));
      doorLights.update((side) => night.isLit(side));
      // После поимки или победы — только офис, даже если монитор был поднят.
      const feed = night.monitorUp && night.status === 'running';
      monsters.update(night, feed ? 'feed' : 'office');
      if (feed) {
        const cam = def.cameras.find((c) => c.id === night.camera)!;
        feedCamera.position.set(cam.at[0], NIGHT.cameraHeight, cam.at[1]);
        feedCamera.lookAt(cam.look[0], 0.8, cam.look[1]);
        monitor.show();
        monitor.update(night);
        renderer.render(scene, feedCamera);
      } else {
        monitor.hide();
        officeCamera.rotation.set(OFFICE_PITCH, yaw, 0);
        renderer.render(scene, officeCamera);
      }
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
