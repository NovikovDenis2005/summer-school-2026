import { useEffect, useState } from 'react';
import { api, ApiCallError } from '../api/client.js';
import type { Booking } from '../types.js';
import { formatDateTime, minutesToStart, rub, statusLabel, statusTone } from '../format.js';
import { StarRating } from '../components/StarRating.js';

interface Props {
  reloadKey: number;
  onChanged: () => void;
}

export function BookingsScreen({ reloadKey, onChanged }: Props) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setBookings(null);
    api
      .listBookings()
      .then((r) => setBookings(r.bookings))
      .catch(() => setError('Не удалось загрузить брони'));
  }

  useEffect(() => load(), [reloadKey]);

  async function cancel(b: Booking) {
    try {
      await api.cancel(b.id);
      onChanged();
    } catch (e) {
      alert(e instanceof ApiCallError ? e.message : 'Ошибка отмены');
    }
  }

  if (error) return <p className="empty">{error}</p>;
  if (bookings === null) return <p className="empty">Загрузка…</p>;
  if (bookings.length === 0)
    return (
      <div className="empty">
        <p className="empty__title">У вас пока нет записей</p>
        <p className="empty__hint">Выберите заезд на вкладке «Заезды».</p>
      </div>
    );

  return (
    <div className="screen">
      <header className="screen__head">
        <h1>Мои брони</h1>
      </header>
      <div className="list">
        {bookings.map((b) => {
          const late = minutesToStart(b.slot.startsAt) <= 60;
          return (
            <div key={b.id} className="card booking">
              <div className="booking__head">
                <span className="booking__time">{formatDateTime(b.slot.startsAt)}</span>
                <span className={`badge badge--${statusTone(b.status)}`}>
                  {statusLabel(b.status)}
                </span>
              </div>
              <div className="slot__track">
                {b.slot.marshal.name} · {rub(b.priceRub)} ·{' '}
                {b.gearOption === 'rent' ? 'прокат' : 'своя экипировка'}
              </div>

              {b.status === 'cancelled_by_center' && b.cancelReason && (
                <p className="reason">Причина отмены: {b.cancelReason}</p>
              )}

              {b.status === 'confirmed' &&
                (late ? (
                  <p className="reason">
                    Поздняя отмена невозможна, свяжитесь с центром: +7 900 000-00-00
                  </p>
                ) : (
                  <button className="btn btn--sm btn--ghost" onClick={() => cancel(b)}>
                    Отменить
                  </button>
                ))}

              {b.status === 'completed' &&
                (b.rating ? (
                  <div className="rated">
                    <StarRating value={b.rating.stars} readOnly />
                    {b.rating.comment && <span className="rated__comment">«{b.rating.comment}»</span>}
                  </div>
                ) : (
                  <RatingForm bookingId={b.id} onDone={onChanged} />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RatingForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (stars < 1) return;
    setBusy(true);
    try {
      await api.rate(bookingId, stars, comment);
      onDone();
    } catch (e) {
      alert(e instanceof ApiCallError ? e.message : 'Ошибка');
      setBusy(false);
    }
  }

  return (
    <div className="rate-form">
      <span className="rate-form__label">Оцените маршала:</span>
      <StarRating value={stars} onChange={setStars} />
      <input
        className="input"
        placeholder="Комментарий (необязательно)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button className="btn btn--sm" onClick={submit} disabled={stars < 1 || busy}>
        Отправить оценку
      </button>
    </div>
  );
}
