'use client';

import { SymbolConfig, SymbolId } from '@/lib/types';

interface Props {
  symbols: SymbolConfig[];
  value: SymbolId;
  onChange: (v: SymbolId) => void;
}

// 艺术风品种切换：下划线式，选中项底部金线
export function SymbolSwitcher({ symbols, value, onChange }: Props) {
  return (
    <div className="inline-flex items-end gap-6 border-b border-line">
      {symbols.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className="press group relative pb-2 pt-1 text-left"
          >
            <div className={`font-serif text-base tracking-wide transition-colors ${active ? 'text-ink' : 'text-subtle group-hover:text-muted'}`}>
              {s.name}
            </div>
            <div className="font-display text-[11px] tracking-[0.2em] uppercase text-subtle">
              {s.nameEn}
            </div>
            <span
              className={`absolute -bottom-px left-0 h-[2px] bg-accent transition-all duration-300 ${
                active ? 'w-full opacity-100' : 'w-0 opacity-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
