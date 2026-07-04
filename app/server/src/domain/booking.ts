import type {
  Booking,
  EffectiveBookingStatus,
  GearOption,
  Rating,
  Slot,
} from '../types.js';
import { Errors } from './errors.js';
import { getStore, LATE_CANCEL_MINUTES, nextId } from '../store/store.js';

const MIN = 60 * 1000;

/** Завершился ли заезд (старт + длительность в прошлом). */
export function slotEnded(slot: Slot, now: Date): boolean {
  const endMs = new Date(slot.startsAt).getTime() + slot.durationMin * MIN;
  return now.getTime() >= endMs;
}

/** Производный статус брони для клиента (AD-3). */
export function effectiveStatus(
  booking: Booking,
  slot: Slot,
  now: Date,
): EffectiveBookingStatus {
  if (booking.status === 'confirmed' && slotEnded(slot, now)) return 'completed';
  return booking.status;
}

function findSlot(slotId: string): Slot {
  const slot = getStore().slots.find((s) => s.id === slotId);
  if (!slot) throw Errors.notFound();
  return slot;
}

function findOwnBooking(bookingId: string, userId: string): Booking {
  const booking = getStore().bookings.find(
    (b) => b.id === bookingId && b.userId === userId,
  );
  if (!booking) throw Errors.notFound();
  return booking;
}

/**
 * Создать бронь (US-04, R-004).
 * Проверка «есть место → декремент» выполняется синхронно, без await между
 * чтением и записью — это гарантирует отсутствие двойных броней (AD-2).
 */
export function createBooking(
  userId: string,
  slotId: string,
  gearOption: GearOption,
  now: Date,
): Booking {
  const slot = findSlot(slotId);

  if (slot.status !== 'scheduled') throw Errors.slotNotBookable();
  if (new Date(slot.startsAt).getTime() <= now.getTime()) {
    throw Errors.slotNotBookable(); // заезд уже начался/прошёл
  }

  const duplicate = getStore().bookings.find(
    (b) => b.slotId === slotId && b.userId === userId && b.status === 'confirmed',
  );
  if (duplicate) throw Errors.alreadyBooked();

  if (gearOption === 'rent' && slot.freeRentGear <= 0) throw Errors.rentUnavailable();
  if (slot.freeKarts <= 0) throw Errors.noSeats();

  // --- атомарная секция (без await) ---
  slot.freeKarts -= 1;
  if (gearOption === 'rent') slot.freeRentGear -= 1;

  const booking: Booking = {
    id: nextId('b'),
    slotId,
    userId,
    gearOption,
    status: 'confirmed',
    priceRub: slot.priceRub,
    createdAt: now.toISOString(),
    cancelledAt: null,
    cancelReason: null,
    ratingId: null,
  };
  getStore().bookings.push(booking);
  return booking;
}

/** Отмена брони клиентом (US-06, A-004). */
export function cancelBooking(userId: string, bookingId: string, now: Date): Booking {
  const booking = findOwnBooking(bookingId, userId);
  const slot = findSlot(booking.slotId);

  if (effectiveStatus(booking, slot, now) !== 'confirmed') {
    throw Errors.notCancellable();
  }

  const minutesToStart = (new Date(slot.startsAt).getTime() - now.getTime()) / MIN;
  if (minutesToStart <= LATE_CANCEL_MINUTES) throw Errors.lateCancel();

  booking.status = 'cancelled_by_client';
  booking.cancelledAt = now.toISOString();
  slot.freeKarts += 1;
  if (booking.gearOption === 'rent') slot.freeRentGear += 1;
  return booking;
}

/** Оценка маршала после завершённого заезда (US-08, A-005). */
export function rateBooking(
  userId: string,
  bookingId: string,
  stars: number,
  comment: string | null,
  now: Date,
): Rating {
  const booking = findOwnBooking(bookingId, userId);

  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw Errors.invalidRating();
  }

  const slot = findSlot(booking.slotId);
  if (effectiveStatus(booking, slot, now) !== 'completed') {
    throw Errors.notCompleted();
  }
  if (booking.ratingId) throw Errors.alreadyRated();

  const rating: Rating = {
    id: nextId('r'),
    bookingId: booking.id,
    marshalId: slot.marshalId,
    stars,
    comment: comment && comment.trim() ? comment.trim() : null,
    createdAt: now.toISOString(),
  };
  getStore().ratings.push(rating);
  booking.ratingId = rating.id;
  recomputeMarshalRating(slot.marshalId);
  return rating;
}

/** Пересчёт агрегированного рейтинга маршала. */
function recomputeMarshalRating(marshalId: string): void {
  const store = getStore();
  const marshal = store.marshals.find((m) => m.id === marshalId);
  if (!marshal) return;
  const stars = store.ratings
    .filter((r) => r.marshalId === marshalId)
    .map((r) => r.stars);
  marshal.ratingCount = stars.length;
  marshal.ratingAvg = stars.length
    ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10
    : null;
}

/**
 * Симуляция отмены заезда центром/по погоде (R-008). Действие внешней
 * инфраструктуры — вне клиентского контракта (dev-эндпоинт).
 */
export function cancelSlotByCenter(slotId: string, reason: string, now: Date): Slot {
  const slot = findSlot(slotId);
  slot.status = 'cancelled_by_center';
  slot.cancelReason = reason;

  for (const booking of getStore().bookings) {
    if (booking.slotId === slotId && booking.status === 'confirmed') {
      booking.status = 'cancelled_by_center';
      booking.cancelReason = reason;
      booking.cancelledAt = now.toISOString();
      // push-уведомление (в MVP — лог; реальная доставка — на бэкенде)
      console.log(
        `[push] Клиенту ${booking.userId}: заезд отменён центром. Причина: ${reason}`,
      );
    }
  }
  return slot;
}
