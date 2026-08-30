'use client';

import { Interval, MaConfig, Range } from '@/lib/types';
import { Segmented } from './ui/Segmented';
import { Toggle } from './ui/Toggle';
import { CROSS_PRESETS } from '@/config/indicators';

interface Props {
  intervals: { value: Interval; label: string }[];
  ranges: { value: Range; label: string }[];
  interval: Interval;
  range: Range;
  onInterval: (v: Interval) => void;
  onRange: (v: Range) => void;
  mas: MaConfig[];
  onMaToggle: (id: string, enabled: boolean) => void;
  crossEnabled: boolean;
  onCrossToggle: (v: boolean) => void;
  crossPreset: string;
  onCrossPreset: (v: string) => void;
  bollEnabled: boolean;
  onBollToggle: (v: boolean) => void;
  rsiEnabled: boolean;
  onRsiToggle: (v: boolean) => void;
}

export function ChartControls(props: Props) {
  return (
    <section className="card rounded-sm px-6 py-5 md:px-10 space-y-5">
      {/* 周期 / 区间 */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Group label="周期">
          <Segmented options={props.intervals} value={props.interval} onChange={props.onInterval} />
        </Group>
        <Group label="区间">
          <Segmented options={props.ranges} value={props.range} onChange={props.onRange} />
        </Group>
      </div>

      <div className="h-px bg-line" />

      {/* 均线 */}
      <Group label="均线">
        <div className="flex flex-wrap gap-x-6 gap-y-2.5 pt-1">
          {props.mas.map((m) => (
            <Toggle
              key={m.id}
              checked={m.enabled}
              onChange={(v) => props.onMaToggle(m.id, v)}
              color={m.color}
              label={`${m.kind.toUpperCase()}${m.period}`}
            />
          ))}
        </div>
      </Group>

      <div className="h-px bg-line" />

      {/* 金叉死叉 */}
      <Group label="信号">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1">
          <Toggle checked={props.crossEnabled} onChange={props.onCrossToggle} label="金叉 / 死叉" />
          <Segmented
            options={CROSS_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            value={props.crossPreset}
            onChange={props.onCrossPreset}
          />
        </div>
      </Group>

      <div className="h-px bg-line" />

      {/* 副图指标 */}
      <Group label="指标">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1">
          <Toggle checked={props.bollEnabled} onChange={props.onBollToggle} label="布林带 20,2" />
          <Toggle checked={props.rsiEnabled} onChange={props.onRsiToggle} label="RSI 14" />
        </div>
      </Group>
    </section>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-[10px] uppercase tracking-[0.25em] text-subtle w-8 shrink-0">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
