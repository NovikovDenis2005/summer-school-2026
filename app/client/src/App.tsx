import { useState } from 'react';
import { SlotsScreen } from './screens/SlotsScreen.js';
import { SlotDetail } from './screens/SlotDetail.js';
import { BookingsScreen } from './screens/BookingsScreen.js';

type Tab = 'slots' | 'bookings';

export function App() {
  const [tab, setTab] = useState<Tab>('slots');
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <div className="phone">
      <div className="phone__brand">🏎️ Апекс</div>

      <main className="phone__body">
        {openSlot ? (
          <SlotDetail
            slotId={openSlot}
            onBack={() => setOpenSlot(null)}
            onBooked={() => {
              setOpenSlot(null);
              setTab('bookings');
              reload();
            }}
          />
        ) : tab === 'slots' ? (
          <SlotsScreen onOpen={setOpenSlot} reloadKey={reloadKey} />
        ) : (
          <BookingsScreen reloadKey={reloadKey} onChanged={reload} />
        )}
      </main>

      {!openSlot && (
        <nav className="tabbar">
          <button
            className={`tabbar__btn ${tab === 'slots' ? 'is-active' : ''}`}
            onClick={() => setTab('slots')}
          >
            Заезды
          </button>
          <button
            className={`tabbar__btn ${tab === 'bookings' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('bookings');
              reload();
            }}
          >
            Мои брони
          </button>
        </nav>
      )}
    </div>
  );
}
