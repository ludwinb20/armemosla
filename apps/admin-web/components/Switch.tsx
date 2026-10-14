'use client';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
}

export function Switch({ checked, onChange, disabled, id, label }: SwitchProps) {
  return (
    <label className="switch" htmlFor={id}>
      {label ? <span className="switch-label">{label}</span> : null}
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden />
    </label>
  );
}
