# Bandy

Браузерная 3D-игра от первого лица: лабиринт комнат, инвентарь, взаимодействие
предметов, выход через дверь EXIT.

Играть: https://navoznov.github.io/bandy/

## Разработка

```
npm install
npm run dev              # dev-сервер
npm run dev -- --host    # доступно с телефона по локальной сети
npm test                 # тесты ядра
npm run build            # сборка в dist/
```

Управление: WASD — движение, мышь — обзор, E — взаимодействие, I или Tab — инвентарь.
На телефоне: левая половина экрана — движение, правая — обзор, кнопки справа.

## Документы

- Дизайн: `docs/superpowers/specs/2026-08-24-bandy-design.md`
- План реализации: `docs/superpowers/plans/2026-08-24-bandy-vertical-slice.md`
- Правила работы с кодом: `CLAUDE.md`
