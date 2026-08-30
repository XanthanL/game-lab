'use client';

interface Option<T> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

// 艺术风分段选择：文字 + 选中底部金线
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex items-center gap-1 border-b border-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`press relative px-2.5 py-1 text-[12px] tracking-wide ${
              active ? 'text-ink' : 'text-subtle hover:text-muted'
            }`}
          >
            {o.label}
            <span
              className={`absolute -bottom-px left-1 h-[2px] bg-accent transition-[width,opacity] duration-300 motion-reduce:transition-none ${
                active ? 'w-[calc(100%-0.5rem)] opacity-100' : 'w-0 opacity-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
