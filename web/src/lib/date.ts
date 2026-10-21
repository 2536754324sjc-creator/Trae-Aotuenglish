/**
 * 日期/周次工具 —— 服务端与客户端共用，统一按 Asia/Shanghai 切天。
 * 周次使用 ISO 8601（周一为一周开始），与 /api/reports/weekly?week=2026-W43 对齐。
 */

const TZ = 'Asia/Shanghai';

export function shanghaiDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isoWeekKey(date: Date = new Date()): string {
  const key = shanghaiDateKey(date);
  // 用 UTC 零点做纯日历运算，避免服务器/浏览器时区影响
  const d = new Date(`${key}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseWeekKey(key: string): { year: number; week: number } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  return { year, week };
}

export type WeekRange = {
  key: string;
  startKey: string;
  endKey: string;
  /** 周一至周日 7 个日期键 */
  dayKeys: string[];
  label: string;
};

export function weekRange(key: string): WeekRange {
  const parsed = parseWeekKey(key);
  if (!parsed) {
    throw new Error(`Invalid ISO week: ${key}`);
  }
  const { year, week } = parsed;

  // 1 月 4 日必定在第 1 周；先回到该周周一，再按周偏移
  const monday = new Date(Date.UTC(year, 0, 4));
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1 + (week - 1) * 7);

  const dayKeys: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  return {
    key,
    startKey: dayKeys[0],
    endKey: dayKeys[6],
    dayKeys,
    label: `${formatMonthDay(dayKeys[0])}–${formatMonthDay(dayKeys[6])}`,
  };
}

export function shiftWeek(key: string, delta: number): string {
  const { startKey } = weekRange(key);
  const d = new Date(`${startKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return isoWeekKey(d);
}

export function formatMonthDay(dateKey: string): string {
  return `${dateKey.slice(5, 7)}/${dateKey.slice(8, 10)}`;
}

export const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'] as const;
