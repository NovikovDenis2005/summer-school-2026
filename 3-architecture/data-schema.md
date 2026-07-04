# 3. Схема данных

Каноническая схема = контракт API (R-015). Ниже — сущности, связи и поля. В MVP
хранятся in-memory; типы соответствуют TypeScript-моделям в `app/server/src`.

---

## ER-диаграмма

```
   ┌────────────┐         ┌─────────────┐          ┌──────────────┐
   │   User      │ 1     * │   Booking    │ *      1 │    Slot       │
   │ (клиент)    │─────────│              │──────────│              │
   └────────────┘         └──────┬──────┘          └──────┬───────┘
                                  │ 1                       │ *
                                  │                         │ 1
                                  │ 0..1              ┌──────┴───────┐
                           ┌──────┴──────┐            │   Marshal     │
                           │   Rating     │ *       1 │ (маршал)      │
                           │              │───────────│              │
                           └─────────────┘            └──────────────┘
```

- `User 1—* Booking` — у клиента много броней.
- `Slot 1—* Booking` — на слот много броней (в пределах `totalKarts`).
- `Slot *—1 Marshal` — слот ведёт один маршал.
- `Booking 0..1—1 Rating` — у завершённой брони может быть одна оценка.
- `Rating *—1 Marshal` — оценки агрегируются в рейтинг маршала.

---

## Сущности

### Marshal — маршал-инструктор
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | идентификатор |
| `name` | string | имя |
| `ratingAvg` | number \| null | средний рейтинг (1–5), null если оценок нет |
| `ratingCount` | number | число оценок |

### Slot — слот заезда
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | идентификатор |
| `startsAt` | string (ISO-8601) | время старта |
| `durationMin` | number | длительность заезда, мин |
| `trackConfig` | `'short'` \| `'long'` | конфигурация трассы (короткая/длинная) |
| `marshal` | Marshal | ведущий маршал (встроен для клиента) |
| `totalKarts` | number | всего картов в слоте |
| `freeKarts` | number | свободно картов (уменьшается при брони) |
| `priceRub` | number | цена заезда, ₽ |
| `gearRentPriceRub` | number | цена проката экипировки, ₽ |
| `freeRentGear` | number | свободный прокатный фонд (комплектов) |
| `address` | string | адрес центра |
| `meetingPoint` | string | место сбора |
| `status` | `'scheduled'` \| `'cancelled_by_center'` | статус слота (R-008) |
| `cancelReason` | string \| null | причина отмены центром |

**Инварианты слота:**
- `0 ≤ freeKarts ≤ totalKarts`.
- `trackConfig = 'short'` ⇒ `totalKarts ≤ 8` (новичковый лимит, A-001).
- `trackConfig = 'long'` ⇒ `totalKarts ≤ 14`.

### Booking — бронь
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | идентификатор |
| `slotId` | string | ссылка на слот |
| `userId` | string | ссылка на клиента |
| `gearOption` | `'own'` \| `'rent'` | экипировка: своя / прокат |
| `status` | BookingStatus | см. ниже |
| `priceRub` | number | зафиксированная цена на момент записи |
| `createdAt` | string (ISO) | когда создана |
| `cancelledAt` | string \| null | когда отменена |
| `cancelReason` | string \| null | причина (для отмены центром) |
| `ratingId` | string \| null | ссылка на оценку, если поставлена |

**BookingStatus** (хранимый): `'confirmed'` · `'cancelled_by_client'` ·
`'cancelled_by_center'`.
**Производный статус** при чтении (AD-3): если `confirmed` и слот завершился →
клиенту отдаётся `'completed'`.

### Rating — оценка маршала
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | идентификатор |
| `bookingId` | string | ссылка на бронь (уникальна) |
| `marshalId` | string | ссылка на маршала |
| `stars` | number (1–5) | оценка |
| `comment` | string \| null | необязательный комментарий |
| `createdAt` | string (ISO) | когда поставлена |

### User — клиент
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | идентификатор |
| `name` | string | имя |
| `phone` | string | телефон |
| `isRegular` | boolean | постоянный клиент (задел под лояльность, A-007) |

---

## Бизнес-правила на данных (сводка)

1. **Бронь (R-004):** создаётся только если `slot.status='scheduled'`, слот не прошёл,
   `freeKarts>0`, и у клиента нет активной брони на этот слот. При успехе — `freeKarts−1`.
2. **Прокат (A-002):** `gearOption='rent'` допустим только при `freeRentGear>0`.
3. **Отмена клиентом (A-004):** только `confirmed`; если до `startsAt` > 60 мин →
   `cancelled_by_client`, `freeKarts+1`; иначе — отказ `LATE_CANCEL`.
4. **Отмена центром (R-008):** `slot.status='cancelled_by_center'`, брони слота →
   `cancelled_by_center` с причиной; повторная запись запрещена.
5. **Оценка (A-005):** только для завершённой брони, `stars∈[1..5]`, одна на бронь.
