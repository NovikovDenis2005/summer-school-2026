import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getStore, resetStore, DEMO_USER_ID } from '../src/store/store.js';

const app = createApp();

beforeEach(() => resetStore());

function futureSlotId(): string {
  const taken = new Set(
    getStore().bookings.filter((b) => b.userId === DEMO_USER_ID).map((b) => b.slotId),
  );
  const slot = getStore().slots.find(
    (s) =>
      s.status === 'scheduled' &&
      new Date(s.startsAt).getTime() > Date.now() + 2 * 60 * 60 * 1000 &&
      s.freeKarts > 0 &&
      !taken.has(s.id),
  )!;
  return slot.id;
}

describe('GET /api/slots (US-01, R-027)', () => {
  it('возвращает только будущие запланированные слоты', async () => {
    const res = await request(app).get('/api/slots');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
    for (const s of res.body.slots) {
      expect(s.status).toBe('scheduled');
      expect(new Date(s.startsAt).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
    }
  });

  it('по умолчанию не выходит за горизонт 7 дней', async () => {
    const res = await request(app).get('/api/slots');
    const horizon = Date.now() + 7 * 24 * 60 * 60 * 1000;
    for (const s of res.body.slots) {
      expect(new Date(s.startsAt).getTime()).toBeLessThanOrEqual(horizon);
    }
  });

  it('фильтр дат сужает выборку и даёт empty state для дальнего периода', async () => {
    const from = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/slots`).query({ from, to });
    expect(res.body.slots).toEqual([]);
  });

  it('встраивает объект маршала', async () => {
    const res = await request(app).get('/api/slots');
    expect(res.body.slots[0].marshal).toHaveProperty('name');
    expect(res.body.slots[0]).not.toHaveProperty('marshalId');
  });
});

describe('POST /api/bookings (US-04, R-004)', () => {
  it('happy path -> 201 и место списано', async () => {
    const id = futureSlotId();
    const before = (await request(app).get(`/api/slots/${id}`)).body.freeKarts;
    const res = await request(app).post('/api/bookings').send({ slotId: id, gearOption: 'own' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
    const after = (await request(app).get(`/api/slots/${id}`)).body.freeKarts;
    expect(after).toBe(before - 1);
  });

  it('повторная запись -> 409 ALREADY_BOOKED', async () => {
    const id = futureSlotId();
    await request(app).post('/api/bookings').send({ slotId: id, gearOption: 'own' });
    const res = await request(app).post('/api/bookings').send({ slotId: id, gearOption: 'own' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_BOOKED');
  });

  it('нет мест -> 409 NO_SEATS', async () => {
    const full = getStore().slots.find((s) => s.freeKarts === 0)!;
    const res = await request(app)
      .post('/api/bookings')
      .set('x-user-id', 'u-other')
      .send({ slotId: full.id, gearOption: 'own' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_SEATS');
  });

  it('прокат при пустом фонде -> 400 RENT_UNAVAILABLE', async () => {
    const noRent = getStore().slots.find(
      (s) => s.freeRentGear === 0 && s.freeKarts > 0 && new Date(s.startsAt).getTime() > Date.now(),
    )!;
    const res = await request(app)
      .post('/api/bookings')
      .set('x-user-id', 'u-other')
      .send({ slotId: noRent.id, gearOption: 'rent' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RENT_UNAVAILABLE');
  });

  it('некорректная экипировка -> 400', async () => {
    const id = futureSlotId();
    const res = await request(app).post('/api/bookings').send({ slotId: id, gearOption: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/bookings/:id/cancel (US-06)', () => {
  it('поздняя отмена -> 409 LATE_CANCEL', async () => {
    const res = await request(app).post('/api/bookings/b-2/cancel');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LATE_CANCEL');
  });

  it('чужая бронь -> 404', async () => {
    const res = await request(app)
      .post('/api/bookings/b-1/cancel')
      .set('x-user-id', 'someone-else');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/bookings/:id/rating (US-08)', () => {
  it('оценка завершённого заезда -> 201', async () => {
    const res = await request(app).post('/api/bookings/b-1/rating').send({ stars: 5 });
    expect(res.status).toBe(201);
    expect(res.body.stars).toBe(5);
  });

  it('оценка незавершённого -> 409 NOT_COMPLETED', async () => {
    const id = futureSlotId();
    const booking = await request(app).post('/api/bookings').send({ slotId: id, gearOption: 'own' });
    const res = await request(app).post(`/api/bookings/${booking.body.id}/rating`).send({ stars: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_COMPLETED');
  });
});

describe('DEV: отмена центром (US-07, R-008)', () => {
  it('бронь -> cancelled_by_center, слот исчезает из каталога', async () => {
    const id = futureSlotId();
    await request(app).post('/api/bookings').send({ slotId: id, gearOption: 'own' });
    await request(app).post(`/api/dev/slots/${id}/cancel-by-center`).send({ reason: 'Гололёд' });

    const bookings = (await request(app).get('/api/bookings')).body.bookings;
    const mine = bookings.find((b: any) => b.slotId === id);
    expect(mine.status).toBe('cancelled_by_center');
    expect(mine.cancelReason).toBe('Гололёд');

    const catalog = (await request(app).get('/api/slots')).body.slots;
    expect(catalog.find((s: any) => s.id === id)).toBeUndefined();
  });
});
