'use client';

import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
} from 'lightweight-charts';
import { BollConfig, Candle, CrossPoint, MaConfig, RsiConfig } from '@/lib/types';
import { bollingerBands, closes, computeMa, detectCrosses, rsi } from '@/lib/indicators';

interface CrossOption {
  enabled: boolean;
  shortMa: MaConfig;
  longMa: MaConfig;
}

interface Props {
  candles: Candle[];
  fullCandles: Candle[];
  mas: MaConfig[];
  cross: CrossOption | null;
  boll: BollConfig;
  rsi: RsiConfig;
  isDark: boolean;
}

const THEME = {
  light: {
    text: '#6b6358',
    grid: 'rgba(227,220,203,0.55)',
    border: '#e3dccb',
    up: '#b91c1c',
    down: '#4d7c5f',
  },
  dark: {
    text: '#9a9388',
    grid: 'rgba(42,38,32,0.6)',
    border: '#2a2620',
    up: '#dc4848',
    down: '#5ba374',
  },
};

// 金叉金色、死叉黑色
const CROSS_COLOR = { golden: '#c9a961', death: '#1c1917' };
const CROSS_COLOR_DARK = { golden: '#d4af37', death: '#e8e0d0' };

export function GoldChart({ candles, fullCandles, mas, cross, boll, rsi: rsiCfg, isDark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const maRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const bollRefs = useRef<{ upper?: ISeriesApi<'Line'>; middle?: ISeriesApi<'Line'>; lower?: ISeriesApi<'Line'> }>({});
  const crossPointsRef = useRef<CrossPoint[]>([]);
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  // RSI 副图
  const rsiChartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const syncingRef = useRef(false);

  // 创建主图（仅一次）
  useEffect(() => {
    if (!containerRef.current) return;
    const t = isDark ? THEME.dark : THEME.light;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: t.text,
        fontFamily: 'var(--font-cormorant), Georgia, serif',
      },
      grid: {
        vertLines: { color: t.grid },
        horzLines: { color: t.grid },
      },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      autoSize: true,
    });
    chartRef.current = chart;
    candleRef.current = chart.addCandlestickSeries({
      upColor: t.up,
      downColor: t.down,
      borderUpColor: t.up,
      borderDownColor: t.down,
      wickUpColor: t.up,
      wickDownColor: t.down,
    });
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      maRefs.current.clear();
      bollRefs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主题切换：更新主图配色
  useEffect(() => {
    const chart = chartRef.current;
    const series = candleRef.current;
    if (!chart || !series) return;
    const t = isDark ? THEME.dark : THEME.light;
    chart.applyOptions({
      layout: { textColor: t.text },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
    });
    series.applyOptions({
      upColor: t.up,
      downColor: t.down,
      borderUpColor: t.up,
      borderDownColor: t.down,
      wickUpColor: t.up,
      wickDownColor: t.down,
    });
  }, [isDark]);

  // 更新蜡烛数据（仅显示区间）
  useEffect(() => {
    if (!candleRef.current) return;
    const data = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // 更新均线 / 布林带 / 金叉死叉标记
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const enabledIds = new Set(mas.filter((m) => m.enabled).map((m) => m.id));
    for (const [id, series] of maRefs.current) {
      if (!enabledIds.has(id)) {
        chart.removeSeries(series);
        maRefs.current.delete(id);
      }
    }

    // 用含前置预热的 fullCandles 计算，保证大周期指标在显示区间内完整绘制
    const fullValues = closes(fullCandles);
    const fullTimes = fullCandles.map((c) => c.time);
    const displayStart = candles.length > 0 ? candles[0].time : 0;

    const sliceLine = (
      arr: (number | null)[],
    ): { time: UTCTimestamp; value: number }[] =>
      arr
        .map((v, i) =>
          v == null || fullTimes[i] < displayStart
            ? null
            : { time: fullTimes[i] as UTCTimestamp, value: v },
        )
        .filter((x): x is { time: UTCTimestamp; value: number } => x !== null);

    for (const m of mas) {
      if (!m.enabled) continue;
      let series = maRefs.current.get(m.id);
      if (!series) {
        series = chart.addLineSeries({
          color: m.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        maRefs.current.set(m.id, series);
      }
      series.setData(sliceLine(computeMa(fullValues, m.period, m.kind)));
    }

    // 布林带：上中下三轨，中轨虚线
    const b = bollRefs.current;
    if (boll.enabled) {
      const bb = bollingerBands(fullValues, boll.period, boll.multiplier);
      if (!b.upper) {
        b.upper = chart.addLineSeries({ color: boll.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        b.middle = chart.addLineSeries({ color: boll.color, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
        b.lower = chart.addLineSeries({ color: boll.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      }
      b.upper.setData(sliceLine(bb.upper));
      b.middle?.setData(sliceLine(bb.middle));
      b.lower!.setData(sliceLine(bb.lower));
    } else if (b.upper && b.middle && b.lower) {
      chart.removeSeries(b.upper);
      chart.removeSeries(b.middle);
      chart.removeSeries(b.lower);
      bollRefs.current = {};
    }

    // 金叉死叉：用 fullCandles 计算，drawCrossMarkers 会自动过滤显示区间外的点
    const points =
      cross && cross.enabled
        ? detectCrosses(
            computeMa(fullValues, cross.shortMa.period, cross.shortMa.kind),
            computeMa(fullValues, cross.longMa.period, cross.longMa.kind),
            fullTimes,
          )
        : [];
    crossPointsRef.current = points;
    drawCrossMarkers();
    requestAnimationFrame(() => drawCrossMarkers());
  }, [candles, fullCandles, mas, cross, boll, isDark]);

  // 绘制空心圆圈：在交叉点 (time, price) 位置叠加 SVG 圆圈
  function drawCrossMarkers() {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;
    const container = containerRef.current;
    const oldSvg = container?.querySelector('svg.cross-overlay');
    if (oldSvg) oldSvg.remove();
    const points = crossPointsRef.current;
    if (points.length === 0) return;

    const c = isDarkRef.current ? CROSS_COLOR_DARK : CROSS_COLOR;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('cross-overlay');
    svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;overflow:visible';
    for (const p of points) {
      const coord = candle.priceToCoordinate(p.price);
      // lightweight-charts 的 indexToCoordinate 仅接受整数索引，浮点返回 0
      // 改用两根相邻 K 线的 x 坐标线性插值，精准定位交叉点
      const x0 = chart.timeScale().timeToCoordinate(p.time0 as UTCTimestamp);
      const x1 = chart.timeScale().timeToCoordinate(p.time1 as UTCTimestamp);
      if (coord == null || x0 == null || x1 == null) continue;
      const timeCoord = x0 + (x1 - x0) * p.t;
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', String(timeCoord));
      circle.setAttribute('cy', String(coord));
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', p.type === 'golden' ? c.golden : c.death);
      circle.setAttribute('stroke-width', '1.5');
      svg.appendChild(circle);
    }
    container?.appendChild(svg);
  }

  // 滚动/缩放时重绘圆圈
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = () => drawCrossMarkers();
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    chart.timeScale().subscribeVisibleTimeRangeChange(handler);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RSI 副图：创建/销毁（依赖开关）
  useEffect(() => {
    if (!rsiCfg.enabled || !rsiContainerRef.current) return;
    const t = isDarkRef.current ? THEME.dark : THEME.light;
    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: t.text,
        fontFamily: 'var(--font-cormorant), Georgia, serif',
      },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      autoSize: true,
    });
    rsiChartRef.current = rsiChart;
    const series = rsiChart.addLineSeries({
      color: rsiCfg.color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      // 固定 0~100 范围
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
        margins: { above: 8, below: 8 },
      }),
    });
    rsiSeriesRef.current = series;
    // 超买/超卖参考线
    series.createPriceLine({ price: 70, color: t.up, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });
    series.createPriceLine({ price: 30, color: t.down, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });

    // 时间轴双向同步
    const mainChart = chartRef.current;
    const syncToRsi = (range: ReturnType<ReturnType<IChartApi['timeScale']>['getVisibleLogicalRange']>) => {
      if (syncingRef.current || !range) return;
      syncingRef.current = true;
      rsiChart.timeScale().setVisibleLogicalRange(range);
      syncingRef.current = false;
    };
    const syncToMain = (range: ReturnType<ReturnType<IChartApi['timeScale']>['getVisibleLogicalRange']>) => {
      if (syncingRef.current || !range) return;
      syncingRef.current = true;
      mainChart?.timeScale().setVisibleLogicalRange(range);
      syncingRef.current = false;
    };
    mainChart?.timeScale().subscribeVisibleLogicalRangeChange(syncToRsi);
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(syncToMain);
    // 初始同步主图范围
    const initRange = mainChart?.timeScale().getVisibleLogicalRange();
    if (initRange) rsiChart.timeScale().setVisibleLogicalRange(initRange);

    return () => {
      mainChart?.timeScale().unsubscribeVisibleLogicalRangeChange(syncToRsi);
      rsiChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncToMain);
      rsiChart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsiCfg.enabled]);

  // RSI 数据更新
  useEffect(() => {
    const series = rsiSeriesRef.current;
    if (!series || !rsiCfg.enabled) return;
    const fullValues = closes(fullCandles);
    const fullTimes = fullCandles.map((c) => c.time);
    const displayStart = candles.length > 0 ? candles[0].time : 0;
    const r = rsi(fullValues, rsiCfg.period);
    const data = r
      .map((v, i) =>
        v == null || fullTimes[i] < displayStart
          ? null
          : { time: fullTimes[i] as UTCTimestamp, value: v },
      )
      .filter((x): x is { time: UTCTimestamp; value: number } => x !== null);
    series.setData(data);
  }, [candles, fullCandles, rsiCfg]);

  // RSI 副图主题切换
  useEffect(() => {
    const rsiChart = rsiChartRef.current;
    if (!rsiChart) return;
    const t = isDark ? THEME.dark : THEME.light;
    rsiChart.applyOptions({
      layout: { textColor: t.text },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
    });
  }, [isDark]);

  return (
    <div className="flex flex-col h-[420px] w-full md:h-[540px]">
      <div ref={containerRef} className="relative flex-1 min-h-0 w-full" />
      {rsiCfg.enabled && (
        <div ref={rsiContainerRef} className="relative h-[120px] w-full shrink-0" />
      )}
    </div>
  );
}
