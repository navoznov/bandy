/** За этим расстоянием тревожиться не о чем. */
const RANGE = 15;

export function createDread(): { update(distance: number | null, chasing: boolean, dt: number): void } {
  const el = document.querySelector<HTMLElement>('#dread');
  if (!el) throw new Error('Разметка виньетки не найдена.');
  let pulse = 0;

  return {
    update(distance, chasing, dt) {
      if (distance === null || distance >= RANGE) { el.style.opacity = '0'; return; }
      const nearness = 1 - distance / RANGE;
      if (chasing) {
        // Пульсация — второй канал: игрок отличает «он где-то тут» от «он идёт
        // за мной», а это разные решения — затаиться или бежать.
        pulse += dt * 6;
        el.style.opacity = String(nearness * (0.75 + 0.25 * Math.sin(pulse)));
      } else {
        pulse = 0;
        el.style.opacity = String(nearness * 0.45);
      }
    },
  };
}
