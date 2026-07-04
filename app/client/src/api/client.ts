import type { Booking, GearOption, Rating, Slot } from '../types.js';

/** Ошибка API с кодом контракта (architecture.md §4). */
export class ApiCallError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = body?.error ?? { code: 'UNKNOWN', message: 'Ошибка запроса' };
    throw new ApiCallError(err.code, err.message);
  }
  return body as T;
}

export const api = {
  listSlots(range?: { from?: string; to?: string }): Promise<{ slots: Slot[] }> {
    const q = new URLSearchParams();
    if (range?.from) q.set('from', range.from);
    if (range?.to) q.set('to', range.to);
    const qs = q.toString();
    return call(`/slots${qs ? `?${qs}` : ''}`);
  },

  getSlot(id: string): Promise<Slot> {
    return call(`/slots/${id}`);
  },

  listBookings(): Promise<{ bookings: Booking[] }> {
    return call('/bookings');
  },

  book(slotId: string, gearOption: GearOption): Promise<Booking> {
    return call('/bookings', {
      method: 'POST',
      body: JSON.stringify({ slotId, gearOption }),
    });
  },

  cancel(bookingId: string): Promise<Booking> {
    return call(`/bookings/${bookingId}/cancel`, { method: 'POST' });
  },

  rate(bookingId: string, stars: number, comment: string): Promise<Rating> {
    return call(`/bookings/${bookingId}/rating`, {
      method: 'POST',
      body: JSON.stringify({ stars, comment }),
    });
  },
};
