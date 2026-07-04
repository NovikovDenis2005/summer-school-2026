# BUG-01 — Сервер и тесты падают на старте (TDZ: `Cannot access 'DAY' before initialization`)

- **Severity:** Blocker (сервер вообще не поднимается)
- **Компонент:** API, `app/server/src/store/store.ts`
- **Найден:** при первом запуске автотестов (`npm test`) — оба тест-файла упали ещё
  на этапе загрузки модуля (0 тестов выполнено).
- **Статус:** ✅ исправлен и перепроверен.

## Симптом

```
ReferenceError: Cannot access 'DAY' before initialization
  ❯ seed src/store/store.ts:82:37
  ❯ src/store/store.ts:17:20
```

`GET /api/*` и все тесты недоступны — падение при инициализации модуля.

## Требование / ожидание

Модуль хранилища должен корректно инициализироваться: при импорте создаётся сид
расписания (`let store = seed()`).

## Причина

Функция `seed()` вызывается на 17-й строке (`let store = seed()`), но использует
константы `MIN/HOUR/DAY`, объявленные через `const` **ниже** по файлу. Из-за
**temporal dead zone** (TDZ) обращение к `DAY` до её инициализации бросает
`ReferenceError`. Объявления функций поднимаются (hoisting), а `const` — нет.

## Исправление

Константы времени `MIN/HOUR/DAY` перенесены **выше** вызова `seed()` — до строки
`let store = seed()`.

```ts
// store.ts — было: const MIN/HOUR/DAY объявлены после `let store = seed()`
// стало: подняты над вызовом seed()
export const DEMO_USER_ID = 'u-demo';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let store: Store = seed();
```

## Промпт (Claude Opus 4.8)

```
Тесты падают с ReferenceError: Cannot access 'DAY' before initialization в
store.ts:82 внутри seed(), вызываемой на store.ts:17. Объясни причину и предложи
минимальную правку.
```

## Проверка после фикса

- `npm test` → **31 тест PASS** (ранее — 0 выполнено, 2 упавших файла).
- Сервер поднимается: `GET /api/health` → `{ "ok": true }`, `GET /api/slots` → 20 слотов.

## Commit

`fix(api): move time constants above seed() to avoid TDZ (BUG-01)`
(в рамках коммита серверной части).
