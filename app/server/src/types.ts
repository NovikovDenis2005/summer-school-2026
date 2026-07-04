// Каноническая схема данных = контракт API (см. 3-architecture/data-schema.md).

export type TrackConfig = 'short' | 'long';
export type GearOption = 'own' | 'rent';
export type SlotStatus = 'scheduled' | 'cancelled_by_center';

/** Хранимый статус брони. Статус 'completed' — производный (AD-3), не хранится. */
export type StoredBookingStatus =
  | 'confirmed'
  | 'cancelled_by_client'
  | 'cancelled_by_center';

/** Статус, отдаваемый клиенту (с учётом производного 'completed'). */
export type EffectiveBookingStatus = StoredBookingStatus | 'completed';

export interface Marshal {
  id: string;
  name: string;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface Slot {
  id: string;
  startsAt: string; // ISO-8601 UTC
  durationMin: number;
  trackConfig: TrackConfig;
  marshalId: string;
  totalKarts: number;
  freeKarts: number;
  priceRub: number;
  gearRentPriceRub: number;
  freeRentGear: number;
  address: string;
  meetingPoint: string;
  status: SlotStatus;
  cancelReason: string | null;
}

export interface Booking {
  id: string;
  slotId: string;
  userId: string;
  gearOption: GearOption;
  status: StoredBookingStatus;
  priceRub: number;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  ratingId: string | null;
}

export interface Rating {
  id: string;
  bookingId: string;
  marshalId: string;
  stars: number; // 1..5
  comment: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  isRegular: boolean;
}

// ----- Формы ответов клиенту (встроенные объекты) -----

export interface SlotView extends Omit<Slot, 'marshalId'> {
  marshal: Marshal;
}

export interface BookingView {
  id: string;
  slotId: string;
  gearOption: GearOption;
  status: EffectiveBookingStatus;
  priceRub: number;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  slot: SlotView;
  rating: Rating | null;
}
