import type { Course, TodayProgress, Unit, UnitStatus } from '@/lib/types';
import { shanghaiDateKey } from '@/lib/date';
import { getDb } from './db';
import type { DbCourse, DbUnit } from './db';
import { ServiceError } from './errors';

/** 已审核单元才对外可见；index/status 属于学习者进度，在这里补齐 */
function publishedUnits(course: DbCourse): DbUnit[] {
  return course.units.filter((unit) => unit.reviewed);
}

function statusFor(
  units: DbUnit[],
  unitId: string,
  completedIds: Set<string>,
): UnitStatus {
  if (completedIds.has(unitId)) return 'done';
  const firstIncomplete = units.findIndex((unit) => !completedIds.has(unit.unitId));
  return units.findIndex((unit) => unit.unitId === unitId) === firstIncomplete
    ? 'current'
    : 'locked';
}

function toUnit(
  unit: DbUnit,
  index: number,
  units: DbUnit[],
  completedIds: Set<string>,
): Unit {
  return {
    unitId: unit.unitId,
    index,
    level: unit.level,
    topic: unit.topic,
    titleZh: unit.titleZh,
    wordCount: unit.wordCount,
    estMinutes: unit.estMinutes,
    status: statusFor(units, unit.unitId, completedIds),
    questions: unit.questions,
  };
}

function toCourse(course: DbCourse): Course {
  return {
    slug: course.slug,
    titleZh: course.titleZh,
    titleEn: course.titleEn,
    level: course.level,
    domain: course.domain,
    unitCount: publishedUnits(course).length,
  };
}

export async function listCourses(level?: string): Promise<Course[]> {
  const db = await getDb();
  return db.courses
    .filter((course) => !level || course.level === level)
    .map(toCourse);
}

export async function getCourseDetail(slug: string): Promise<{
  course: Course;
  units: Unit[];
} | null> {
  const db = await getDb();
  const course = db.courses.find((item) => item.slug === slug);
  if (!course) return null;

  const units = publishedUnits(course);
  const completedIds = new Set(Object.keys(db.progress.completed));
  return {
    course: toCourse(course),
    units: units.map((unit, i) => toUnit(unit, i + 1, units, completedIds)),
  };
}

export async function getUnitById(unitId: string): Promise<Unit | null> {
  const db = await getDb();
  for (const course of db.courses) {
    const units = publishedUnits(course);
    const index = units.findIndex((unit) => unit.unitId === unitId);
    if (index >= 0) {
      const completedIds = new Set(Object.keys(db.progress.completed));
      return toUnit(units[index], index + 1, units, completedIds);
    }
  }
  return null;
}

export async function getCourseUnit(
  slug: string,
  unitId: string,
): Promise<Unit | null> {
  const db = await getDb();
  const course = db.courses.find((item) => item.slug === slug);
  if (!course) return null;
  const units = publishedUnits(course);
  const index = units.findIndex((unit) => unit.unitId === unitId);
  if (index < 0) return null;
  const completedIds = new Set(Object.keys(db.progress.completed));
  return toUnit(units[index], index + 1, units, completedIds);
}

export function starForRatio(firstTryCount: number, total: number): number {
  if (total === 0) return 1;
  const ratio = firstTryCount / total;
  if (ratio >= 1) return 3;
  if (ratio >= 0.7) return 2;
  return 1;
}

export async function getProgress(): Promise<TodayProgress> {
  const db = await getDb();
  const course =
    db.courses.find((item) => item.slug === db.user.activeCourseSlug) ?? db.courses[0];
  if (!course) {
    throw new ServiceError(500, 'no_course', '课程数据为空');
  }

  const units = publishedUnits(course);
  const completedIds = new Set(Object.keys(db.progress.completed));
  const mapped = units.map((unit, i) => toUnit(unit, i + 1, units, completedIds));

  const today = shanghaiDateKey(new Date());
  const starsToday = Object.values(db.progress.completed).filter(
    (item) => shanghaiDateKey(item.completedAt) === today,
  ).length;
  const earnedStars = Object.values(db.progress.completed).reduce(
    (sum, item) => sum + item.stars,
    0,
  );
  const current = mapped.find((unit) => unit.status === 'current');

  return {
    learnerName: db.user.name,
    level: db.user.level,
    starsToday,
    starsGoal: db.user.starsGoal,
    starTotal: db.user.starTotalBase + earnedStars,
    currentUnitIndex: current?.index ?? mapped.length,
    chestRemaining: Math.max(0, db.user.starsGoal - starsToday),
    units: mapped,
  };
}
