import type { World } from '../core/world';

export interface InventoryUi {
  isOpen(): boolean;
  toggle(): void;
  close(): void;
}

export function createInventoryUi(world: World): InventoryUi {
  const root = document.querySelector<HTMLElement>('#inventory');
  const list = document.querySelector<HTMLUListElement>('#inventory-list');
  const empty = document.querySelector<HTMLElement>('#inventory-empty');
  if (!root || !list || !empty) throw new Error('Разметка инвентаря не найдена.');

  function render(): void {
    const items = world.inventory();
    const held = world.held();

    list!.replaceChildren();
    for (const id of items) {
      const entry = document.createElement('li');
      entry.textContent = world.level.itemDefs[id]?.name ?? id;
      // render вручную звать не надо: setHeld эмитит handChanged, а на него
      // подписан этот же render. Иначе список перерисуется дважды, причём второй
      // раз — из обработчика на строке, которую первая перерисовка уже выбросила.
      entry.addEventListener('click', () => world.setHeld(id));
      list!.append(entry);
    }

    // Предмет в руках в world.inventory() не попадает: setHeld переводит его
    // в 'hand', а inventoryItems отдаёт только 'inventory'. Поэтому он не
    // подсвечивается в списке, а дописывается отдельной строкой.
    if (held !== null) {
      const entry = document.createElement('li');
      entry.textContent = `${world.level.itemDefs[held]?.name ?? held} (в руках)`;
      entry.classList.add('held');
      entry.addEventListener('click', () => world.setHeld(null));
      list!.append(entry);
    }

    empty!.hidden = items.length > 0 || held !== null;
  }

  world.on((event) => {
    if (event.kind === 'itemTaken' || event.kind === 'itemGone' || event.kind === 'handChanged') {
      if (!root!.hidden) render();
    }
  });

  return {
    isOpen: () => !root.hidden,
    toggle() {
      root.hidden = !root.hidden;
      if (!root.hidden) render();
    },
    close() { root.hidden = true; },
  };
}
