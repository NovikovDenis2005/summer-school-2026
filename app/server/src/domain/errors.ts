/** Доменная ошибка с кодом контракта и HTTP-статусом (см. architecture.md §4). */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const Errors = {
  notFound: () => new DomainError('NOT_FOUND', 404, 'Не найдено'),
  slotNotBookable: () =>
    new DomainError('SLOT_NOT_BOOKABLE', 409, 'Заезд недоступен для записи'),
  alreadyBooked: () =>
    new DomainError('ALREADY_BOOKED', 409, 'Вы уже записаны на этот заезд'),
  rentUnavailable: () =>
    new DomainError('RENT_UNAVAILABLE', 400, 'Прокат экипировки недоступен'),
  noSeats: () => new DomainError('NO_SEATS', 409, 'Мест уже нет'),
  lateCancel: () =>
    new DomainError(
      'LATE_CANCEL',
      409,
      'Поздняя отмена невозможна, свяжитесь с центром',
    ),
  notCancellable: () =>
    new DomainError('NOT_CANCELLABLE', 409, 'Эту бронь нельзя отменить'),
  notCompleted: () =>
    new DomainError('NOT_COMPLETED', 409, 'Оценить можно только завершённый заезд'),
  alreadyRated: () =>
    new DomainError('ALREADY_RATED', 409, 'Оценка уже поставлена'),
  invalidRating: () =>
    new DomainError('INVALID_RATING', 400, 'Оценка должна быть от 1 до 5'),
};
