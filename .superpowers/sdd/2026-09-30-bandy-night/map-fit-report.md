# Отчёт: карта камер на низком экране

## Изменения
- src/night/map.ts: чистая `mapScale(viewportHeight, bottomPx, topReserve)` = clamp(0..1, (H - top - bottom) / (MAP_HEIGHT + CAM_BUTTON)).
- src/night/monitor.ts: `fitMap()` читает `getComputedStyle(map).bottom`, ставит `transform: scale(..)`; вызывается в `show()` и на `resize` (только при показанном мониторе: у display:none отступ может быть не в px).
- src/config.ts: `NIGHT.mapTopReserve = 64`.
- index.html: `#monitor-map { transform-origin: bottom right }`; `@media (max-height: 420px)`: карта `bottom: calc(16px + safe-area)`, `#night.monitor #nb-monitor` слева, `transform: none`.

## Расчёт для 696x272
scale = (272 - 64 - 16) / 274 = 0.70. Карта 224x161 px, верх карты на 272-16-161 = 95 px, выступ квадратика 15 px, итого 80 px >= резерва 64 (энергия заканчивается около 16+~24 px). Квадратик 44*0.7 = 31 px (меньше 44, но при масштабе без переноса кнопки было бы ~24).

## Перенесённая кнопка «Монитор»
Слева: x 20..240+ (min-width 220), y 272-16-64 = 192..256. Карта: x от 696-16-224 = 456, то есть зазор по горизонтали >200 px. `#monitor-cam`: top 90 + ~26 px высоты = ~116 < 192; `#monitor-rec`: top 60 +~22 = ~82 < 192. Пересечений нет (запас по вертикали 76 px).

## Тесты
RED: `npx vitest run src/night/map.test.ts` до реализации, 3 failed (mapScale не существует). GREEN: после, `npm test` 30 файлов, 342 теста, tsc чист; `npm run build` прошёл (только предупреждение о размере чанка).
Тесты: высокий экран -> 1; 272/16/64 -> 0.70 и верх >= резерва; нет места -> 0.
Вживую не проверено (браузер не запускался).
