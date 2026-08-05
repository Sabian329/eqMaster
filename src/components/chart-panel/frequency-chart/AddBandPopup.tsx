import { formatDb, formatFrequency } from '../../../utils/format';

interface AddBandPopupProps {
  frequency: number;
  measuredDb: number;
  left: number;
  top: number;
  tooClose: boolean;
  onAdd: () => void;
  onClose: () => void;
}

export function AddBandPopup({
  frequency,
  measuredDb,
  left,
  top,
  tooClose,
  onAdd,
  onClose,
}: AddBandPopupProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Close add band popup"
        className="chart-add-band-backdrop"
        onClick={onClose}
      />
      <div
        className="chart-add-band-popup"
        style={{ left, top }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="chart-add-band-popup__freq">{formatFrequency(frequency)}</div>
        <div className="chart-add-band-popup__meta">Measured: {formatDb(measuredDb)}</div>
        {tooClose ? (
          <div className="chart-add-band-popup__hint">Within 1 Hz of an existing band</div>
        ) : (
          <button
            type="button"
            className="chart-add-band-popup__add"
            aria-label={`Add EQ band at ${formatFrequency(frequency)}`}
            onClick={onAdd}
          >
            +
          </button>
        )}
      </div>
    </>
  );
}
