import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { Slot } from '../types.js';
import { formatDateTime, rub, trackLabel } from '../format.js';

interface Props {
  onOpen: (slotId: string) => void;
  reloadKey: number;
}

export function SlotsScreen({ onOpen, reloadKey }: Props) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function load(range?: { from?: string; to?: string }) {
    setSlots(null);
    setError(null);
    api
      .listSlots(range)
      .then((r) => setSlots(r.slots))
      .catch(() => setError('Не удалось загрузить расписание'));
  }

  useEffect(() => load(), [reloadKey]);

  function applyFilter() {
    const range: { from?: string; to?: string } = {};
    if (from) range.from = new Date(from).toISOString();
    if (to) {
      // BUG-02 fix: дата из input type="date" — это полночь выбранного дня.
      // Чтобы диапазон включал весь этот день (а не только 00:00), берём конец дня.
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.to = end.toISOString();
    }
    load(range);
  }

  function resetFilter() {
    setFrom('');
    setTo('');
    setShowFilter(false);
    load();
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1>Заезды</h1>
        <button className="link" onClick={() => setShowFilter((v) => !v)}>
          {showFilter ? 'Скрыть фильтр' : 'Фильтр по датам'}
        </button>
      </header>

      {showFilter && (
        <div className="filter card">
          <label>
            С <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            По <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="filter__actions">
            <button className="btn btn--sm" onClick={applyFilter}>
              Применить
            </button>
            <button className="btn btn--sm btn--ghost" onClick={resetFilter}>
              Сброс
            </button>
          </div>
        </div>
      )}

      {error && <p className="empty">{error}</p>}

      {!error && slots === null && <p className="empty">Загрузка…</p>}

      {!error && slots?.length === 0 && (
        <div className="empty">
          <p className="empty__title">Пока нет доступных заездов</p>
          <p className="empty__hint">Попробуйте изменить период или загляните позже.</p>
        </div>
      )}

      <div className="list">
        {slots?.map((s) => {
          const soldOut = s.freeKarts <= 0;
          return (
            <button
              key={s.id}
              className="card slot"
              onClick={() => onOpen(s.id)}
              disabled={soldOut}
            >
              <div className="slot__time">{formatDateTime(s.startsAt)}</div>
              <div className="slot__track">{trackLabel(s.trackConfig)}</div>
              <div className="slot__row">
                <span className="marshal">🏁 {s.marshal.name}</span>
                <span className={`seats ${soldOut ? 'seats--out' : ''}`}>
                  {soldOut ? 'Мест нет' : `${s.freeKarts} мест`}
                </span>
              </div>
              <div className="slot__price">{rub(s.priceRub)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
