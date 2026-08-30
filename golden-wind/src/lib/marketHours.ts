import type { SymbolId } from './types';

// Beijing time (UTC+8) trading hours for each symbol.
// day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday

interface Session {
  startDay: number;
  startHour: number;
  startMinute: number;
  endDay: number;
  endHour: number;
  endMinute: number;
}

interface MarketSchedule {
  sessions: Session[];
  name: string;
}

// XAU (London spot gold via 东方财富 122.XAU):
// International gold market, open Mon 00:00 — Sat 00:00 Beijing time.
const XAU_SCHEDULE: MarketSchedule = {
  name: '伦敦金',
  sessions: [
    { startDay: 1, startHour: 0, startMinute: 0, endDay: 6, endHour: 0, endMinute: 0 },
  ],
};

// AU9999 (Shanghai Gold Exchange via 东方财富 118.AU9999):
// Day: 9:00–11:30, 13:30–15:30  Night: 20:00–02:30 (next day)
// Closed Sat 02:30 — Mon 09:00
const AU9999_SCHEDULE: MarketSchedule = {
  name: '沪金9999',
  sessions: [
    // Per-day sessions for accurate next-event calculation
    // Mon
    { startDay: 1, startHour: 9, startMinute: 0, endDay: 1, endHour: 11, endMinute: 30 },
    { startDay: 1, startHour: 13, startMinute: 30, endDay: 1, endHour: 15, endMinute: 30 },
    { startDay: 1, startHour: 20, startMinute: 0, endDay: 2, endHour: 2, endMinute: 30 },
    // Tue
    { startDay: 2, startHour: 9, startMinute: 0, endDay: 2, endHour: 11, endMinute: 30 },
    { startDay: 2, startHour: 13, startMinute: 30, endDay: 2, endHour: 15, endMinute: 30 },
    { startDay: 2, startHour: 20, startMinute: 0, endDay: 3, endHour: 2, endMinute: 30 },
    // Wed
    { startDay: 3, startHour: 9, startMinute: 0, endDay: 3, endHour: 11, endMinute: 30 },
    { startDay: 3, startHour: 13, startMinute: 30, endDay: 3, endHour: 15, endMinute: 30 },
    { startDay: 3, startHour: 20, startMinute: 0, endDay: 4, endHour: 2, endMinute: 30 },
    // Thu
    { startDay: 4, startHour: 9, startMinute: 0, endDay: 4, endHour: 11, endMinute: 30 },
    { startDay: 4, startHour: 13, startMinute: 30, endDay: 4, endHour: 15, endMinute: 30 },
    { startDay: 4, startHour: 20, startMinute: 0, endDay: 5, endHour: 2, endMinute: 30 },
    // Fri
    { startDay: 5, startHour: 9, startMinute: 0, endDay: 5, endHour: 11, endMinute: 30 },
    { startDay: 5, startHour: 13, startMinute: 30, endDay: 5, endHour: 15, endMinute: 30 },
    { startDay: 5, startHour: 20, startMinute: 0, endDay: 6, endHour: 2, endMinute: 30 },
  ],
};

const SCHEDULES: Record<SymbolId, MarketSchedule> = {
  XAU: XAU_SCHEDULE,
  AU9999: AU9999_SCHEDULE,
};

function getBeijingTime(now: Date) {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const bj = new Date(utcMs + 8 * 3600_000);
  return {
    day: bj.getUTCDay(),
    hour: bj.getUTCHours(),
    minute: bj.getUTCMinutes(),
    date: bj,
  };
}

function sessionToMinutes(day: number, hour: number, minute: number): number {
  return day * 24 * 60 + hour * 60 + minute;
}

function isInSession(
  curDay: number,
  curHour: number,
  curMinute: number,
  session: Session,
): boolean {
  const cur = sessionToMinutes(curDay, curHour, curMinute);
  const start = sessionToMinutes(session.startDay, session.startHour, session.startMinute);
  const end = sessionToMinutes(session.endDay, session.endHour, session.endMinute);
  return cur >= start && cur < end;
}

export function isMarketOpen(symbolId: SymbolId, now: Date = new Date()): boolean {
  const schedule = SCHEDULES[symbolId];
  const { day, hour, minute } = getBeijingTime(now);
  return schedule.sessions.some((s) => isInSession(day, hour, minute, s));
}

export function getMarketName(symbolId: SymbolId): string {
  return SCHEDULES[symbolId].name;
}

export function getNextEvent(symbolId: SymbolId, now: Date = new Date()): {
  type: 'open' | 'close';
  time: Date;
} | null {
  const schedule = SCHEDULES[symbolId];
  const { day, hour, minute } = getBeijingTime(now);
  const cur = sessionToMinutes(day, hour, minute);

  let nextOpen: number | null = null;
  let nextClose: number | null = null;

  for (const s of schedule.sessions) {
    const start = sessionToMinutes(s.startDay, s.startHour, s.startMinute);
    const end = sessionToMinutes(s.endDay, s.endHour, s.endMinute);

    if (start > cur && (nextOpen == null || start < nextOpen)) {
      nextOpen = start;
    }
    if (cur >= start && cur < end && (nextClose == null || end < nextClose)) {
      nextClose = end;
    }
  }

  // Wrap-around: if no future open found in current week, use first session of next week
  if (nextOpen == null) {
    const firstSession = schedule.sessions[0];
    if (firstSession) {
      nextOpen = sessionToMinutes(firstSession.startDay, firstSession.startHour, firstSession.startMinute) + 10080;
    }
  }

  if (nextClose == null && nextOpen != null) {
    return { type: 'open', time: minutesToDate(nextOpen, now) };
  }
  if (nextClose != null) {
    return { type: 'close', time: minutesToDate(nextClose, now) };
  }
  return null;
}

function minutesToDate(totalMinutes: number, reference: Date): Date {
  const base = new Date(reference);
  const { day, hour, minute } = getBeijingTime(base);
  const curTotal = sessionToMinutes(day, hour, minute);
  const diff = totalMinutes - curTotal;
  base.setTime(base.getTime() + diff * 60_000);
  return base;
}

export function formatBeijingTime(now: Date): string {
  const { date } = getBeijingTime(now);
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatNextEvent(symbolId: SymbolId, now: Date = new Date()): string {
  const isOpen = isMarketOpen(symbolId, now);
  const event = getNextEvent(symbolId, now);

  if (isOpen) {
    if (!event || event.type !== 'close') return '交易中';
    const mins = Math.round((event.time.getTime() - now.getTime()) / 60_000);
    if (mins <= 0) return '即将休市';
    if (mins < 60) return `${mins} 分钟后休市`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h${remainingMins}m 后休市`;
  } else {
    if (!event || event.type !== 'open') return '休市中';
    const mins = Math.round((event.time.getTime() - now.getTime()) / 60_000);
    if (mins <= 0) return '即将开市';
    if (mins < 60) return `${mins} 分钟后开市`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h${remainingMins}m 后开市`;
  }
}