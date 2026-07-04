import type { BookingStatus, TrackConfig } from './types.js';

const dtf = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return dtf.format(new Date(iso));
}

export function trackLabel(config: TrackConfig): string {
  return config === 'short' ? 'Короткая · для новичков' : 'Длинная · для опытных';
}

export function rub(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`;
}

export function minutesToStart(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

export function statusLabel(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Подтверждена';
    case 'completed':
      return 'Завершён';
    case 'cancelled_by_client':
      return 'Отменена вами';
    case 'cancelled_by_center':
      return 'Отменён центром';
  }
}

export function statusTone(status: BookingStatus): 'ok' | 'muted' | 'warn' {
  if (status === 'confirmed') return 'ok';
  if (status === 'cancelled_by_center') return 'warn';
  return 'muted';
}
