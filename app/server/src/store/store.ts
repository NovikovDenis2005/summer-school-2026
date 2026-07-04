import type { Booking, Marshal, Rating, Slot, User } from '../types.js';

/** Порог поздней отмены: отмена запрещена, если до старта <= стольких минут (A-004). */
export const LATE_CANCEL_MINUTES = 60;

export interface Store {
  users: User[];
  marshals: Marshal[];
  slots: Slot[];
  bookings: Booking[];
  ratings: Rating[];
  seq: number;
}

export const DEMO_USER_ID = 'u-demo';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let store: Store = seed();

export function getStore(): Store {
  return store;
}

export function resetStore(): void {
  store = seed();
}

export function nextId(prefix: string): string {
  store.seq += 1;
  return `${prefix}-${store.seq}`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Пересоздаёт демо-данные: расписание на 7 дней + показательные брони. */
function seed(): Store {
  const now = Date.now();

  const users: User[] = [
    { id: DEMO_USER_ID, name: 'Гость', phone: '+7 900 000-00-00', isRegular: true },
  ];

  const marshals: Marshal[] = [
    { id: 'm-1', name: 'Игорь', ratingAvg: null, ratingCount: 0 },
    { id: 'm-2', name: 'Света', ratingAvg: null, ratingCount: 0 },
    { id: 'm-3', name: 'Дамир', ratingAvg: null, ratingCount: 0 },
  ];

  const address = 'г. Энск, ул. Гоночная, 1';
  const meetingPoint = 'Стойка регистрации у главного входа';

  const slots: Slot[] = [];
  let s = 0;
  const mkSlot = (p: Partial<Slot> & { startsAt: string; trackConfig: Slot['trackConfig'] }): Slot => {
    s += 1;
    const isShort = p.trackConfig === 'short';
    const total = p.totalKarts ?? (isShort ? 8 : 14);
    return {
      id: `s-${s}`,
      durationMin: 20,
      marshalId: marshals[s % marshals.length].id,
      totalKarts: total,
      freeKarts: p.freeKarts ?? total,
      priceRub: isShort ? 900 : 1200,
      gearRentPriceRub: 300,
      freeRentGear: p.freeRentGear ?? 5,
      address,
      meetingPoint,
      status: 'scheduled',
      cancelReason: null,
      ...p,
    };
  };

  // Расписание на ближайшие 7 дней: по 3 заезда в день в 12:00 / 15:00 / 18:00.
  for (let d = 0; d < 7; d++) {
    const base = new Date(now + d * DAY);
    base.setHours(12, 0, 0, 0);
    const day0 = base.getTime();
    slots.push(mkSlot({ startsAt: iso(day0), trackConfig: 'short' }));
    slots.push(mkSlot({ startsAt: iso(day0 + 3 * HOUR), trackConfig: 'long' }));
    slots.push(mkSlot({ startsAt: iso(day0 + 6 * HOUR), trackConfig: 'long', freeRentGear: 0 }));
  }

  // Показательный слот без свободных мест (для сценария NO_SEATS / гонки).
  const fullSlot = mkSlot({
    startsAt: iso(now + 2 * DAY + 9 * HOUR),
    trackConfig: 'short',
    freeKarts: 0,
  });
  slots.push(fullSlot);

  // Слот, стартующий скоро (для сценария поздней отмены LATE_CANCEL).
  const soonSlot = mkSlot({
    startsAt: iso(now + 40 * MIN),
    trackConfig: 'long',
  });
  slots.push(soonSlot);

  // Прошедший слот (для сценария оценки маршала — бронь завершена).
  const pastSlot = mkSlot({
    startsAt: iso(now - 1 * DAY),
    trackConfig: 'long',
  });
  slots.push(pastSlot);

  // Предзаготовленные брони демо-клиента.
  const bookings: Booking[] = [
    {
      id: 'b-1',
      slotId: pastSlot.id,
      userId: DEMO_USER_ID,
      gearOption: 'rent',
      status: 'confirmed', // прошедший слот -> отдастся клиенту как 'completed'
      priceRub: pastSlot.priceRub,
      createdAt: iso(now - 2 * DAY),
      cancelledAt: null,
      cancelReason: null,
      ratingId: null,
    },
    {
      id: 'b-2',
      slotId: soonSlot.id,
      userId: DEMO_USER_ID,
      gearOption: 'own',
      status: 'confirmed',
      priceRub: soonSlot.priceRub,
      createdAt: iso(now - 3 * HOUR),
      cancelledAt: null,
      cancelReason: null,
      ratingId: null,
    },
  ];
  // Учтём занятые демо-бронями места.
  soonSlot.freeKarts -= 1;

  return {
    users,
    marshals,
    slots,
    bookings,
    ratings: [],
    seq: 1000,
  };
}
