import { useEffect, useState } from 'react';
import { api, ApiCallError } from '../api/client.js';
import type { GearOption, Slot } from '../types.js';
import { formatDateTime, rub, trackLabel } from '../format.js';

interface Props {
  slotId: string;
  onBack: () => void;
  onBooked: () => void;
}

export function SlotDetail({ slotId, onBack, onBooked }: Props) {
  const [slot, setSlot] = useState<Slot | null>(null);
  const [gear, setGear] = useState<GearOption>('own');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSlot(slotId).then(setSlot).catch(() => setError('Слот не найден'));
  }, [slotId]);

  async function book() {
    setBusy(true);
    setError(null);
    try {
      await api.book(slotId, gear);
      onBooked();
    } catch (e) {
      setError(e instanceof ApiCallError ? e.message : 'Не удалось записаться');
      // обновим данные слота — вдруг места кончились
      api.getSlot(slotId).then(setSlot).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  if (error && !slot) return <p className="empty">{error}</p>;
  if (!slot) return <p className="empty">Загрузка…</p>;

  const soldOut = slot.freeKarts <= 0;
  const rentOut = slot.freeRentGear <= 0;

  return (
    <div className="screen">
      <header className="screen__head">
        <button className="link" onClick={onBack}>
          ← Назад
        </button>
      </header>

      <div className="card detail">
        <div className="detail__time">{formatDateTime(slot.startsAt)}</div>
        <div className="slot__track">{trackLabel(slot.trackConfig)}</div>

        <dl className="kv">
          <div>
            <dt>Маршал</dt>
            <dd>
              {slot.marshal.name}
              {slot.marshal.ratingAvg != null && (
                <span className="rating-badge">★ {slot.marshal.ratingAvg}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Длительность</dt>
            <dd>{slot.durationMin} мин</dd>
          </div>
          <div>
            <dt>Адрес</dt>
            <dd>{slot.address}</dd>
          </div>
          <div>
            <dt>Место сбора</dt>
            <dd>{slot.meetingPoint}</dd>
          </div>
          <div>
            <dt>Свободно</dt>
            <dd>{soldOut ? 'Мест нет' : `${slot.freeKarts} из ${slot.totalKarts}`}</dd>
          </div>
          <div>
            <dt>Цена</dt>
            <dd>{rub(slot.priceRub)}</dd>
          </div>
        </dl>

        <fieldset className="gear">
          <legend>Экипировка</legend>
          <label className="gear__opt">
            <input
              type="radio"
              name="gear"
              checked={gear === 'own'}
              onChange={() => setGear('own')}
            />
            Своя (шлем, подшлемник)
          </label>
          <label className="gear__opt">
            <input
              type="radio"
              name="gear"
              checked={gear === 'rent'}
              disabled={rentOut}
              onChange={() => setGear('rent')}
            />
            Прокат · {rub(slot.gearRentPriceRub)}
            {rentOut && <span className="muted"> — нет в наличии</span>}
          </label>
        </fieldset>

        {error && <p className="error-msg">{error}</p>}

        <button className="btn btn--primary" onClick={book} disabled={soldOut || busy}>
          {soldOut ? 'Мест нет' : busy ? 'Записываем…' : 'Записаться'}
        </button>
      </div>
    </div>
  );
}
