import type { Booking, BookingView, Slot, SlotView } from './types.js';
import { getStore } from './store/store.js';
import { effectiveStatus } from './domain/booking.js';

/** Слот с встроенным объектом маршала (без внутреннего marshalId). */
export function toSlotView(slot: Slot): SlotView {
  const { marshalId, ...rest } = slot;
  const marshal = getStore().marshals.find((m) => m.id === marshalId)!;
  return { ...rest, marshal };
}

/** Бронь с производным статусом, встроенным слотом и оценкой. */
export function toBookingView(booking: Booking, now: Date): BookingView {
  const slot = getStore().slots.find((s) => s.id === booking.slotId)!;
  const rating = booking.ratingId
    ? getStore().ratings.find((r) => r.id === booking.ratingId) ?? null
    : null;

  return {
    id: booking.id,
    slotId: booking.slotId,
    gearOption: booking.gearOption,
    status: effectiveStatus(booking, slot, now),
    priceRub: booking.priceRub,
    createdAt: booking.createdAt,
    cancelledAt: booking.cancelledAt,
    cancelReason: booking.cancelReason,
    slot: toSlotView(slot),
    rating,
  };
}
