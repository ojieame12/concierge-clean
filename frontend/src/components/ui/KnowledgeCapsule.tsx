import type { Segment } from '../types';
import './KnowledgeCapsule.css';

interface KnowledgeCapsuleProps {
  rows: Extract<Segment, { type: 'capsule' }>['rows'];
  onSelectValue?: (label: string, value: string) => void;
  disabled?: boolean;
}

export function KnowledgeCapsule({ rows, onSelectValue, disabled = false }: KnowledgeCapsuleProps) {
  if (!rows.length) {
    return null;
  }

  const handleClick = (label: string, value: string) => {
    if (disabled) {
      return;
    }
    onSelectValue?.(label, value);
  };

  return (
    <div className="segment-capsule" data-segment="capsule">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="segment-capsule__row">
          <div className="segment-capsule__label">{row.label}</div>
          <div className="segment-capsule__values">
            {row.values.map((value, valueIndex) => (
              <button
                key={`${value}-${valueIndex}`}
                type="button"
                className="segment-capsule__pill"
                onClick={() => handleClick(row.label, value)}
                disabled={disabled}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
