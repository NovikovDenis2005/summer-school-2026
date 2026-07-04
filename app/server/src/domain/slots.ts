import type { Slot } from '../types.js';

const DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_HORIZON_DAYS = 7; // R-027

/**
 * Каталог доступных слотов (US-01, US-02).
 * - показываются только слоты со статусом 'scheduled';
 * - прошедшие (старт <= now) скрываются;
 * - по умолчанию окно [now, now + 7 дней], иначе [from, to];
 * - сортировка по времени старта по возрастанию.
 */
export function listSlots(all: Slot[], now: Date, from?: Date, to?: Date): Slot[] {
  const nowMs = now.getTime();
  const fromMs = from ? from.getTime() : nowMs;
  const toMs = to ? to.getTime() : nowMs + DEFAULT_HORIZON_DAYS * DAY;

  return all
    .filter((slot) => {
      if (slot.status !== 'scheduled') return false;
      const t = new Date(slot.startsAt).getTime();
      return t >= nowMs && t >= fromMs && t <= toMs;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
