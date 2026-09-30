import type * as THREE from 'three';
import type { Level } from './core/types';
import type { DebugFlags } from './debug';

/**
 * То, что общее у обоих режимов и создаётся в `main.ts` до развилки: уровень,
 * холст, рендерер и выключатель цикла, на который завязаны ловушки ошибок.
 */
export interface RunContext {
  level: Level;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  debug: DebugFlags;
  /** Цикл остановлен — экраном ошибки или финалом. Проверяется первым делом в кадре. */
  isStopped(): boolean;
  stopLoop(): void;
}
