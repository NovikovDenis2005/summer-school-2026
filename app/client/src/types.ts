// Типы контракта API (зеркало 3-architecture/api-contract.md).

export type TrackConfig = 'short' | 'long';
export type GearOption = 'own' | 'rent';
export type BookingStatus =
  | 'confirmed'
  | 'completed'
  | 'cancelled_by_client'
  | 'cancelled_by_center';

export interface Marshal {
  id: string;
  name: string;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface Slot {
  id: string;
  startsAt: string;
  durationMin: number;
  trackConfig: TrackConfig;
  totalKarts: number;
  freeKarts: number;
  priceRub: number;
  gearRentPriceRub: number;
  freeRentGear: number;
  address: string;
  meetingPoint: string;
  status: 'scheduled' | 'cancelled_by_center';
  cancelReason: string | null;
  marshal: Marshal;
}

export interface Rating {
  id: string;
  bookingId: string;
  marshalId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  slotId: string;
  gearOption: GearOption;
  status: BookingStatus;
  priceRub: number;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  slot: Slot;
  rating: Rating | null;
}

export interface ApiError {
  code: string;
  message: string;
}
