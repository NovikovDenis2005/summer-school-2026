import { Router, type Request, type Response } from 'express';
import { DomainError } from '../domain/errors.js';
import {
  cancelBooking,
  cancelSlotByCenter,
  createBooking,
  rateBooking,
} from '../domain/booking.js';
import { listSlots } from '../domain/slots.js';
import { DEMO_USER_ID, getStore, resetStore } from '../store/store.js';
import { toBookingView, toSlotView } from '../views.js';
import type { GearOption } from '../types.js';

/** Идентификация клиента (демо-режим, AD-4). */
function userId(req: Request): string {
  return (req.header('x-user-id') || DEMO_USER_ID).trim();
}

/**
 * Текущее время. Заголовок `x-now` (ISO) — только для детерминированных тестов;
 * в обычной работе используется системное время.
 */
function nowOf(req: Request): Date {
  const h = req.header('x-now');
  return h ? new Date(h) : new Date();
}

/** Обёртка: доменные ошибки → HTTP-ответ единого формата. */
function handle(fn: (req: Request, res: Response) => void) {
  return (req: Request, res: Response) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof DomainError) {
        res.status(err.httpStatus).json({ error: { code: err.code, message: err.message } });
        return;
      }
      console.error(err);
      res.status(500).json({ error: { code: 'INTERNAL', message: 'Внутренняя ошибка' } });
    }
  };
}

export const router = Router();

// ----- Слоты -----

router.get(
  '/slots',
  handle((req, res) => {
    const now = nowOf(req);
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const slots = listSlots(getStore().slots, now, from, to).map(toSlotView);
    res.json({ slots });
  }),
);

router.get(
  '/slots/:id',
  handle((req, res) => {
    const slot = getStore().slots.find((s) => s.id === req.params.id);
    if (!slot) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Слот не найден' } });
      return;
    }
    res.json(toSlotView(slot));
  }),
);

// ----- Брони -----

router.get(
  '/bookings',
  handle((req, res) => {
    const now = nowOf(req);
    const uid = userId(req);
    const bookings = getStore()
      .bookings.filter((b) => b.userId === uid)
      .map((b) => toBookingView(b, now))
      .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));
    res.json({ bookings });
  }),
);

router.post(
  '/bookings',
  handle((req, res) => {
    const now = nowOf(req);
    const { slotId, gearOption } = req.body ?? {};
    if (gearOption !== 'own' && gearOption !== 'rent') {
      res.status(400).json({
        error: { code: 'INVALID_GEAR', message: 'Некорректный выбор экипировки' },
      });
      return;
    }
    const booking = createBooking(userId(req), String(slotId), gearOption as GearOption, now);
    res.status(201).json(toBookingView(booking, now));
  }),
);

router.post(
  '/bookings/:id/cancel',
  handle((req, res) => {
    const now = nowOf(req);
    const booking = cancelBooking(userId(req), req.params.id, now);
    res.json(toBookingView(booking, now));
  }),
);

router.post(
  '/bookings/:id/rating',
  handle((req, res) => {
    const now = nowOf(req);
    const { stars, comment } = req.body ?? {};
    const rating = rateBooking(
      userId(req),
      req.params.id,
      Number(stars),
      comment ?? null,
      now,
    );
    res.status(201).json(rating);
  }),
);

// ----- DEV: симуляция внешней инфраструктуры (вне клиентского контракта) -----

router.post(
  '/dev/slots/:id/cancel-by-center',
  handle((req, res) => {
    const now = nowOf(req);
    const reason = String(req.body?.reason ?? 'Отменён центром');
    const slot = cancelSlotByCenter(req.params.id, reason, now);
    res.json(toSlotView(slot));
  }),
);

router.post(
  '/dev/reset',
  handle((_req, res) => {
    resetStore();
    res.json({ ok: true });
  }),
);
