import * as THREE from 'three';

/** Клетка рисуется кодом: файлов-текстур в проекте нет. */
export function makeGridTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.30)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface RoomMaterials {
  floor: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
}

/**
 * Пол темнее базового цвета комнаты, потолок светлее.
 * Разная светлота сама по себе разделяет поверхности, когда текстур нет.
 */
export function roomMaterials(
  hex: string,
  grid: THREE.CanvasTexture,
  repeatX: number,
  repeatZ: number,
): RoomMaterials {
  const base = new THREE.Color(hex);

  const floorMap = grid.clone();
  floorMap.needsUpdate = true;
  floorMap.repeat.set(repeatX, repeatZ);

  return {
    floor: new THREE.MeshStandardMaterial({
      color: base.clone().multiplyScalar(0.65),
      map: floorMap,
      roughness: 0.95,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: base.clone().lerp(new THREE.Color('#ffffff'), 0.25),
      roughness: 1,
    }),
  };
}

export const WALL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x9a9aa0,
  roughness: 0.9,
});

export const EDGE_MATERIAL = new THREE.LineBasicMaterial({ color: 0x24242a });
