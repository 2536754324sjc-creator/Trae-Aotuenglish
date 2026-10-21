import { randomUUID } from 'node:crypto';
import type {
  ReportRow,
  SessionInput,
  SessionResult,
  TodayProgress,
  WeeklyReportResponse,
} from '@/lib/types';
import {
  formatMonthDay,
  isoWeekKey,
  parseWeekKey,
  shanghaiDateKey,
  weekRange,
  weekdayLabels,
} from '@/lib/date';
import { getDb, persistDb } from './db';
import type { Db, DbSession, DbUnit } from './db';
import { getProgress, starForRatio } from './courses';
import { ServiceError } from './errors';

function findUnit(db: Db, unitId: string): { unit: DbUnit; courseSlug: string } | null {
  for (const course of db.courses) {
    const unit = course.units.find((item) => item.unitId === unitId);
    if (unit) return { unit, courseSlug: course.slug };
  }
  return null;
}

function minutesFor(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

export async function recordSession(input: SessionInput): Promise<SessionResult> {
  const db = await getDb();
  const found = findUnit(db, input.unitId);
  if (!found) {
    throw new ServiceError(404, 'unit_not_found', `找不到单元 ${input.unitId}`);
  }

  const expected = found.unit.questions.length;
  if (input.results.length !== expected) {
    throw new ServiceError(
      400,
      'invalid_results',
      `results 长度应为 ${expected}，实际为 ${input.results.length}`,
    );
  }
  if (input.results.some((value) => typeof value !== 'boolean')) {
    throw new ServiceError(400, 'invalid_results', 'results 必须是布尔数组');
  }
  if (!Number.isFinite(input.durationSec) || input.durationSec < 0) {
    throw new ServiceError(400, 'invalid_duration', 'durationSec 必须是非负数');
  }

  const firstTryCount = input.results.filter(Boolean).length;
  const stars = starForRatio(firstTryCount, expected);
  const now = new Date().toISOString();
  const isFirstCompletion = !db.progress.completed[input.unitId];

  if (isFirstCompletion) {
    db.progress.completed[input.unitId] = { stars, completedAt: now };
  }

  const session: DbSession = {
    id: randomUUID(),
    userId: db.user.id,
    courseSlug: found.courseSlug,
    unitId: input.unitId,
    createdAt: now,
    durationSec: Math.min(Math.round(input.durationSec), 7200),
    results: input.results,
  };
  db.progress.sessions.push(session);

  await persistDb(db);
  const progress: TodayProgress = await getProgress();

  return { stars, firstTryCount, total: expected, progress };
}

type MasteryAccumulator = { firstTry: number; total: number };

export async function getWeeklyReport(week?: string): Promise<WeeklyReportResponse> {
  const db = await getDb();
  const key = week ?? isoWeekKey(new Date());
  if (!parseWeekKey(key)) {
    throw new ServiceError(400, 'invalid_week', 'week 需要形如 2026-W43');
  }

  const range = weekRange(key);
  const activeCourse =
    db.courses.find((course) => course.slug === db.user.activeCourseSlug) ?? db.courses[0];
  const unitsTotal = activeCourse
    ? activeCourse.units.filter((unit) => unit.reviewed).length
    : 0;

  const inWeek = db.progress.sessions.filter((session) => {
    if (session.userId !== db.user.id) return false;
    const day = shanghaiDateKey(session.createdAt);
    return day >= range.startKey && day <= range.endKey;
  });

  const unitById = new Map<string, DbUnit>();
  for (const course of db.courses) {
    for (const unit of course.units) unitById.set(unit.unitId, unit);
  }

  const minutesByDay = new Map<string, number>();
  const rowGroups = new Map<
    string,
    { day: string; unitId: string; questions: number; firstTry: number; seconds: number }
  >();
  const mastery = new Map<string, MasteryAccumulator>();
  const weak = new Map<string, number>();

  for (const session of inWeek) {
    const day = shanghaiDateKey(session.createdAt);
    const minutes = minutesFor(session.durationSec);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + minutes);

    const firstTryInSession = session.results.filter(Boolean).length;
    const rowKey = `${day}|${session.unitId}`;
    const row = rowGroups.get(rowKey) ?? {
      day,
      unitId: session.unitId,
      questions: 0,
      firstTry: 0,
      seconds: 0,
    };
    row.questions += session.results.length;
    row.firstTry += firstTryInSession;
    row.seconds += session.durationSec;
    rowGroups.set(rowKey, row);

    const unit = unitById.get(session.unitId);
    const acc = mastery.get(session.unitId) ?? { firstTry: 0, total: 0 };
    acc.firstTry += firstTryInSession;
    acc.total += session.results.length;
    mastery.set(session.unitId, acc);

    session.results.forEach((ok, index) => {
      if (ok) return;
      const audioText = unit?.questions[index]?.audioText;
      if (!audioText) return;
      weak.set(audioText, (weak.get(audioText) ?? 0) + 1);
    });
  }

  const rows: ReportRow[] = [...rowGroups.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((group) => {
      const unit = unitById.get(group.unitId);
      return {
        day: formatMonthDay(group.day),
        unit: unit?.titleZh ?? group.unitId,
        questions: group.questions,
        accuracy:
          group.questions === 0 ? 0 : Math.round((group.firstTry / group.questions) * 100),
        minutes: minutesFor(group.seconds),
      };
    });

  const unitMastery = [...mastery.entries()]
    .map(([unitId, acc]) => ({
      unit: unitById.get(unitId)?.titleZh ?? unitId,
      percent: acc.total === 0 ? 0 : Math.round((acc.firstTry / acc.total) * 100),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  const weakSounds = [...weak.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([word, count]) => ({
      sound: `/${word}/`,
      noteZh: `「${word}」第一次没答对 ${count} 次，建议再听一遍`,
    }));

  const sessionsByDay = new Set(
    db.progress.sessions.map((session) => shanghaiDateKey(session.createdAt)),
  );
  const today = shanghaiDateKey(new Date());
  const cursor = new Date(`${today}T00:00:00Z`);
  if (!sessionsByDay.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streakDays = 0;
  while (sessionsByDay.has(cursor.toISOString().slice(0, 10))) {
    streakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const minutes = [...minutesByDay.values()].reduce((sum, value) => sum + value, 0);
  const unitsDone = Object.values(db.progress.completed).filter((item) => {
    const day = shanghaiDateKey(item.completedAt);
    return day >= range.startKey && day <= range.endKey;
  }).length;

  const dailyMinutes = inWeek.length
    ? range.dayKeys.map((day, index) => ({
        day: weekdayLabels[index],
        minutes: minutesByDay.get(day) ?? 0,
      }))
    : [];

  return {
    week: range.key,
    report: {
      weekLabel: range.label,
      minutes,
      unitsDone,
      unitsTotal,
      streakDays,
      dailyMinutes,
      weakSounds,
      unitMastery,
    },
    rows,
  };
}
