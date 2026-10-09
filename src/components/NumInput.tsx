import { useEffect, useState } from 'react';

/** Numeric input that keeps the raw text while typing (so "62." works) and reports numbers. */
export function NumInput({ value, onChange, placeholder, decimal = false, className, ariaLabel }: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value == null ? '' : String(value));
  }, [value, focused]);

  return (
    <input
      className={className}
      aria-label={ariaLabel}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        if (!/^\d*\.?\d*$/.test(t)) return;
        setText(t);
        if (t === '' || t === '.') onChange(null);
        else {
          const n = decimal ? parseFloat(t) : parseInt(t, 10);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
    />
  );
}
