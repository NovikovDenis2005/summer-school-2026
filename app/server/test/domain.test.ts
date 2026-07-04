import { beforeEach, describe, expect, it } from 'vitest';
import { getStore, resetStore, DEMO_USER_ID } from '../src/store/store.js';
import {
  cancelBooking,
  createBooking,
  rateBooking,
  cancelSlotByCenter,
  effectiveStatus,
} from '../src/domain/booking.js';
import { listSlots } from '../src/domain/slots.js';
import { DomainError } from '../src/domain/errors.js';

const now = () => new Date();

beforeEach(() => resetStore());

/** Проверяет, что вызов бросает DomainError с ожидаемым кодом контракта. */
function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Ожидалась DomainError ${code}, но исключения не было`);
}

/** Хелпер: будущий бронируемый слот со свободными местами, не занятый демо-клиентом. */
function freeFutureSlot() {
  const store = getStore();
  const taken = new Set(
    store.bookings.filter((b) => b.userId === DEMO_USER_ID).map((b) => b.slotId),
  );
  return store.slots.find(
    (s) =>
      s.status === 'scheduled' &&
      new Date(s.startsAt).getTime() > Date.now() + 2 * 60 * 60 * 1000 &&
      s.freeKarts > 0 &&
      !taken.has(s.id),
  )!;
}

describe('listSlots (US-01/US-02, R-027)', () => {
  it('скрывает прошедшие слоты', () => {
    const past = getStore().slots.filter(
      (s) => new Date(s.startsAt).getTime() < Date.now(),
    );
    expect(past.length).toBeGreaterThan(0); // в сиде есть прошедший слот
    const listed = listSlots(getStore().slots, now());
    expect(listed.every((s) => new Date(s.startsAt).getTime() >= Date.now())).toBe(true);
  });

  it('скрывает слоты, отменённые центром', () => {
    const slot = freeFutureSlot();
    cancelSlotByCenter(slot.id, 'Гололёд', now());
    const listed = listSlots(getStore().slots, now());
    expect(listed.find((s) => s.id === slot.id)).toBeUndefined();
  });

  it('сортирует по времени старта', () => {
    const listed = listSlots(getStore().slots, now());
    const times = listed.map((s) => s.startsAt);
    expect(times).toEqual([...times].sort());
  });
});

describe('createBooking (US-04, R-004)', () => {
  it('успешная запись уменьшает freeKarts на 1', () => {
    const slot = freeFutureSlot();
    const before = slot.freeKarts;
    const booking = createBooking(DEMO_USER_ID, slot.id, 'own', now());
    expect(booking.status).toBe('confirmed');
    expect(slot.freeKarts).toBe(before - 1);
  });

  it('не даёт записаться дважды на один слот', () => {
    const slot = freeFutureSlot();
    createBooking(DEMO_USER_ID, slot.id, 'own', now());
    expectCode(() => createBooking(DEMO_USER_ID, slot.id, 'own', now()), 'ALREADY_BOOKED');
  });

  it('отклоняет запись при отсутствии мест (NO_SEATS)', () => {
    const full = getStore().slots.find((s) => s.freeKarts === 0)!;
    expectCode(() => createBooking('u-x', full.id, 'own', now()), 'NO_SEATS');
  });

  it('отклоняет прокат при пустом фонде (RENT_UNAVAILABLE)', () => {
    const noRent = getStore().slots.find(
      (s) => s.freeRentGear === 0 && s.freeKarts > 0 && new Date(s.startsAt).getTime() > Date.now(),
    )!;
    expectCode(() => createBooking('u-x', noRent.id, 'rent', now()), 'RENT_UNAVAILABLE');
  });

  it('нельзя записаться на отменённый центром слот', () => {
    const slot = freeFutureSlot();
    cancelSlotByCenter(slot.id, 'Гроза', now());
    expectCode(() => createBooking('u-x', slot.id, 'own', now()), 'SLOT_NOT_BOOKABLE');
  });

  it('гонка за последнее место не создаёт двойной брони', () => {
    const slot = freeFutureSlot();
    slot.freeKarts = 1;
    createBooking('u-a', slot.id, 'own', now());
    expectCode(() => createBooking('u-b', slot.id, 'own', now()), 'NO_SEATS');
    expect(slot.freeKarts).toBe(0);
    const bookingsForSlot = getStore().bookings.filter((b) => b.slotId === slot.id);
    expect(bookingsForSlot.length).toBe(1);
  });
});

describe('cancelBooking (US-06, A-004)', () => {
  it('отмена заранее возвращает место', () => {
    const slot = freeFutureSlot();
    const booking = createBooking(DEMO_USER_ID, slot.id, 'own', now());
    const before = slot.freeKarts;
    cancelBooking(DEMO_USER_ID, booking.id, now());
    expect(booking.status).toBe('cancelled_by_client');
    expect(slot.freeKarts).toBe(before + 1);
  });

  it('поздняя отмена (<=60 мин до старта) запрещена', () => {
    // b-2 в сиде — на слот, стартующий через 40 минут
    expectCode(() => cancelBooking(DEMO_USER_ID, 'b-2', now()), 'LATE_CANCEL');
  });

  it('нельзя отменить завершённую бронь', () => {
    // b-1 в сиде — на прошедший слот (completed)
    expectCode(() => cancelBooking(DEMO_USER_ID, 'b-1', now()), 'NOT_CANCELLABLE');
  });
});

describe('rateBooking (US-08, A-005)', () => {
  it('оценка завершённого заезда сохраняется и обновляет рейтинг маршала', () => {
    const rating = rateBooking(DEMO_USER_ID, 'b-1', 5, 'Отличный брифинг', now());
    expect(rating.stars).toBe(5);
    const booking = getStore().bookings.find((b) => b.id === 'b-1')!;
    const marshalId = getStore().slots.find((s) => s.id === booking.slotId)!.marshalId;
    const marshal = getStore().marshals.find((m) => m.id === marshalId)!;
    expect(marshal.ratingCount).toBe(1);
    expect(marshal.ratingAvg).toBe(5);
  });

  it('нельзя оценить незавершённый заезд', () => {
    const slot = freeFutureSlot();
    const booking = createBooking(DEMO_USER_ID, slot.id, 'own', now());
    expectCode(() => rateBooking(DEMO_USER_ID, booking.id, 5, null, now()), 'NOT_COMPLETED');
  });

  it('нельзя оценить дважды', () => {
    rateBooking(DEMO_USER_ID, 'b-1', 4, null, now());
    expectCode(() => rateBooking(DEMO_USER_ID, 'b-1', 3, null, now()), 'ALREADY_RATED');
  });

  it('отклоняет оценку вне диапазона 1..5', () => {
    expectCode(() => rateBooking(DEMO_USER_ID, 'b-1', 6, null, now()), 'INVALID_RATING');
    expectCode(() => rateBooking(DEMO_USER_ID, 'b-1', 0, null, now()), 'INVALID_RATING');
  });
});

describe('cancelSlotByCenter (US-07, R-008)', () => {
  it('переводит бронь в статус cancelled_by_center с причиной', () => {
    const slot = freeFutureSlot();
    const booking = createBooking(DEMO_USER_ID, slot.id, 'own', now());
    cancelSlotByCenter(slot.id, 'Ливень', now());
    expect(booking.status).toBe('cancelled_by_center');
    expect(booking.cancelReason).toBe('Ливень');
    expect(effectiveStatus(booking, slot, now())).toBe('cancelled_by_center');
  });
});
