import type { Question, Unit } from '@/lib/types';
import type { DifyCourse } from '@/lib/dify-adapter';
import { toUnit } from '@/lib/dify-adapter';
import sampleOuCourse from '@/lib/sample-ou-course.json';
import sampleOuTeen from '@/lib/sample-ou-teen.json';
import type { Db, DbCourse, DbSession, DbUnit } from './db';

/**
 * 首次启动时写入的学习数据。
 * 内容来自 OU 样例与原有 mock 题库，进度/历史由这里种下，
 * 之后所有变更都走 API 落盘，不再读本文件。
 */

const unitMeta = [
  { topic: 'Greetings', titleZh: '问候' },
  { topic: 'Colors', titleZh: '颜色' },
  { topic: 'Animals', titleZh: '动物' },
  { topic: 'Numbers', titleZh: '数字' },
  { topic: 'My Family', titleZh: '我的家' },
] as const;

const wordBank: Record<string, string[]> = {
  Greetings: ['hello', 'hi', 'bye', 'thanks', 'please', 'sorry'],
  Colors: ['red', 'blue', 'green', 'yellow', 'pink', 'orange'],
  Animals: ['cat', 'dog', 'bird', 'fish', 'rabbit', 'panda'],
  Numbers: ['one', 'two', 'three', 'four', 'five', 'six'],
  'My Family': ['mom', 'dad', 'sister', 'brother', 'baby', 'grandma'],
};

function buildQuestions(unitIndex: number): Question[] {
  const current = unitMeta[unitIndex] ?? unitMeta[0];
  const bank = wordBank[current.topic] ?? ['hello', 'thank you'];
  const [w1, w2, w3, w4, w5, w6] = bank;
  const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

  return [
    {
      id: `u${unitIndex}-q1`,
      type: 'listen_choose_image',
      promptZh: '听一听，选出正确的图',
      audioText: w1,
      options: [
        { id: 'a', imagePrompt: `${w1} flat illustration`, correct: true },
        { id: 'b', imagePrompt: `${w2} flat illustration`, correct: false },
        { id: 'c', imagePrompt: `${w3} flat illustration`, correct: false },
      ],
    },
    {
      id: `u${unitIndex}-q2`,
      type: 'tap_to_read',
      promptZh: '点一下听发音',
      audioText: w2,
      options: [{ id: 'a', text: capitalize(w2), correct: true }],
    },
    {
      id: `u${unitIndex}-q3`,
      type: 'listen_choose_image',
      promptZh: '听一听，选出正确的图',
      audioText: w3,
      options: [
        { id: 'a', imagePrompt: `${w2} flat illustration`, correct: false },
        { id: 'b', imagePrompt: `${w3} flat illustration`, correct: true },
      ],
    },
    {
      id: `u${unitIndex}-q4`,
      type: 'tap_to_read',
      promptZh: '点一下听发音',
      audioText: w4,
      options: [{ id: 'a', text: capitalize(w4), correct: true }],
    },
    {
      id: `u${unitIndex}-q5`,
      type: 'listen_choose_image',
      promptZh: '再听一次，选出正确的图',
      audioText: w5,
      options: [
        { id: 'a', imagePrompt: `${w4} flat illustration`, correct: false },
        { id: 'b', imagePrompt: `${w5} flat illustration`, correct: true },
        { id: 'c', imagePrompt: `${w6} flat illustration`, correct: false },
      ],
    },
    {
      id: `u${unitIndex}-q6`,
      type: 'tap_to_read',
      promptZh: '最后再听一遍',
      audioText: w6,
      options: [{ id: 'a', text: capitalize(w6), correct: true }],
    },
  ];
}

/** OU 样例的农场题，覆盖「数字」这一关，验证真实生成内容能直接入库 */
function farmQuestions(): Question[] {
  const course = sampleOuCourse as DifyCourse;
  const unit = course.units[0];
  return toUnit(unit, 4, 'current').questions;
}

function kidsUnits(): DbUnit[] {
  return unitMeta.map((meta, i) => ({
    unitId: `kids-a-${meta.topic.toLowerCase().replace(/\s/g, '-')}`,
    level: 'kids-a',
    topic: meta.topic,
    titleZh: meta.titleZh,
    wordCount: 6,
    estMinutes: 5 + (i % 3),
    reviewed: true,
    questions: i === 3 ? farmQuestions() : buildQuestions(i),
  }));
}

function teenUnits(): DbUnit[] {
  const course = sampleOuTeen as DifyCourse;
  const unit: Unit = toUnit(course.units[0], 1, 'current');
  return [
    {
      unitId: unit.unitId,
      level: unit.level,
      topic: unit.topic,
      titleZh: unit.titleZh,
      wordCount: unit.wordCount,
      estMinutes: unit.estMinutes,
      reviewed: true,
      questions: unit.questions,
    },
  ];
}

export function seedDb(): Db {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const courses: DbCourse[] = [
    {
      slug: 'first-words',
      titleZh: '高频词 200',
      titleEn: 'First 200 Words',
      level: 'kids-a',
      domain: 'words',
      units: kidsUnits(),
    },
    {
      slug: 'teen-school',
      titleZh: '校园英语进阶',
      titleEn: 'Teen School Life',
      level: 'teen',
      domain: 'reading',
      units: teenUnits(),
    },
  ];

  const kids = courses[0].units;
  // 今日完成前三关，一次答对 6/6、5/6、4/6 → 3/2/1 星
  const results = [
    [true, true, true, true, true, true],
    [true, true, true, true, true, false],
    [true, true, true, true, false, false],
  ];
  const durations = [360, 480, 300];
  const stars = [3, 2, 1];

  const sessions: DbSession[] = kids.slice(0, 3).map((unit, i) => ({
    id: `seed-session-${i + 1}`,
    userId: 'mia',
    courseSlug: 'first-words',
    unitId: unit.unitId,
    createdAt,
    durationSec: durations[i],
    results: results[i],
  }));

  return {
    version: 1,
    seededAt: createdAt,
    user: {
      id: 'mia',
      name: 'Mia',
      level: 'kids-a',
      activeCourseSlug: 'first-words',
      starsGoal: 5,
      starTotalBase: 122,
    },
    courses,
    progress: {
      completed: {
        [kids[0].unitId]: { stars: stars[0], completedAt: createdAt },
        [kids[1].unitId]: { stars: stars[1], completedAt: createdAt },
        [kids[2].unitId]: { stars: stars[2], completedAt: createdAt },
      },
      sessions,
    },
  };
}
