'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  color?: string;
}

// 艺术风开关：细线轨道 + 小圆点
export function Toggle({ checked, onChange, label, color }: ToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative h-[18px] w-8 rounded-full border transition-colors ${
          checked ? 'border-transparent' : 'border-line'
        }`}
        style={checked ? { backgroundColor: color || 'var(--accent)' } : { backgroundColor: 'transparent' }}
      >
        <span
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all ${
            checked ? 'left-[18px] bg-surface' : 'left-[2px] bg-muted'
          }`}
        />
      </button>
      {label && <span className="text-[13px] text-muted">{label}</span>}
    </label>
  );
}
