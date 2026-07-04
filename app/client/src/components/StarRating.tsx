interface Props {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}

/** Звёздочный рейтинг 1–5. Кликабельный, если задан onChange. */
export function StarRating({ value, onChange, readOnly }: Props) {
  return (
    <div className="stars" role={readOnly ? 'img' : 'radiogroup'} aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= value ? 'star--on' : ''}`}
          disabled={readOnly}
          aria-label={`${n} из 5`}
          onClick={() => onChange?.(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
