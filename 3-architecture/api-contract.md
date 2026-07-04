# 3. Контракт API

Базовый префикс: `/api`. Формат — JSON. Кодировка ошибок — см.
[architecture.md §4](architecture.md). Идентификация клиента — заголовок
`x-user-id` (по умолчанию демо-клиент `u-demo`).

Даты передаются в ISO-8601 (UTC), например `2026-07-05T15:00:00.000Z`.

---

## Слоты

### `GET /api/slots`
Список доступных слотов. Прошедшие слоты не возвращаются.

**Query-параметры:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `from` | ISO-date | сейчас | начало диапазона |
| `to` | ISO-date | сейчас + 7 дней (R-027) | конец диапазона |

**200 OK**
```json
{ "slots": [
  {
    "id": "s-1", "startsAt": "2026-07-05T15:00:00.000Z", "durationMin": 20,
    "trackConfig": "long", "totalKarts": 14, "freeKarts": 9,
    "priceRub": 1200, "gearRentPriceRub": 300, "freeRentGear": 5,
    "address": "ул. Гоночная, 1", "meetingPoint": "Стойка регистрации",
    "status": "scheduled", "cancelReason": null,
    "marshal": { "id": "m-1", "name": "Игорь", "ratingAvg": 4.8, "ratingCount": 25 }
  }
] }
```
Пустой список → `{ "slots": [] }` (клиент показывает empty state).

### `GET /api/slots/:id`
**200 OK** — объект слота (как элемент выше). **404** `NOT_FOUND`.

---

## Брони

### `GET /api/bookings`
Брони текущего клиента (по `x-user-id`), со встроенными слотом и оценкой.
Статус `completed` вычисляется на лету (AD-3).

**200 OK**
```json
{ "bookings": [
  {
    "id": "b-1", "slotId": "s-9", "gearOption": "rent", "status": "completed",
    "priceRub": 1000, "createdAt": "2026-07-01T10:00:00.000Z",
    "cancelledAt": null, "cancelReason": null,
    "slot": { "...": "объект слота" },
    "rating": { "id": "r-1", "stars": 5, "comment": "Топ", "createdAt": "..." }
  }
] }
```

### `POST /api/bookings`
Создать бронь (US-04). Атомарная проверка мест (R-004).

**Тело:**
```json
{ "slotId": "s-1", "gearOption": "own" }   // gearOption: "own" | "rent"
```

**201 Created** — объект брони.
**Ошибки:**
| HTTP | code | Условие |
|------|------|---------|
| 404 | `NOT_FOUND` | слота нет |
| 409 | `SLOT_NOT_BOOKABLE` | слот отменён центром или уже прошёл |
| 409 | `ALREADY_BOOKED` | клиент уже записан на слот |
| 400 | `RENT_UNAVAILABLE` | `rent`, но `freeRentGear = 0` |
| 409 | `NO_SEATS` | `freeKarts = 0` (гонка за место) |

### `POST /api/bookings/:id/cancel`
Отмена брони клиентом (US-06, A-004).

**200 OK** — обновлённая бронь (`status: "cancelled_by_client"`).
**Ошибки:**
| HTTP | code | Условие |
|------|------|---------|
| 404 | `NOT_FOUND` | брони нет / чужая бронь |
| 409 | `NOT_CANCELLABLE` | бронь не в статусе `confirmed` |
| 409 | `LATE_CANCEL` | до старта ≤ 60 мин |

### `POST /api/bookings/:id/rating`
Оценка маршала (US-08, A-005).

**Тело:**
```json
{ "stars": 5, "comment": "Отличный брифинг" }   // comment необязателен
```
**201 Created** — объект оценки.
**Ошибки:**
| HTTP | code | Условие |
|------|------|---------|
| 404 | `NOT_FOUND` | брони нет / чужая бронь |
| 400 | `INVALID_RATING` | `stars` вне [1..5] |
| 409 | `NOT_COMPLETED` | заезд ещё не завершён |
| 409 | `ALREADY_RATED` | оценка уже стоит |

---

## Служебные эндпоинты (симуляция внешней инфраструктуры — вне клиентского контракта)

Помечены как **DEV**: имитируют действия существующего бэкенда, чтобы можно было
продемонстрировать сценарии R-008. В прод-клиенте не используются.

### `POST /api/dev/slots/:id/cancel-by-center`
Тело: `{ "reason": "Гололёд" }`. Отменяет слот центром: слот →
`cancelled_by_center`, все его активные брони → `cancelled_by_center` + push (лог).

### `POST /api/dev/reset`
Пересоздаёт сид расписания (для тестов/демо).
