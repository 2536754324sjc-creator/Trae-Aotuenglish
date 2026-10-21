import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Course, Question } from '@/lib/types';
import type { Level } from '@/design/tokens';
import { seedDb } from './seed';

/**
 * 最小持久化层：单个 JSON 文件 + 原子写入。
 * 数据量很小（一个学习者、两门课），不引入数据库依赖；
 * 换成 SQLite/Postgres 时只需要重写本文件。
 */

export type DbUnit = {
  unitId: string;
  level: Level;
  topic: string;
  titleZh: string;
  wordCount: number;
  estMinutes: number;
  /** 人工审核标记：前端只读已审核内容 */
  reviewed: boolean;
  questions: Question[];
};

export type DbCourse = {
  slug: string;
  titleZh: string;
  titleEn: string;
  level: Level;
  domain: Course['domain'];
  units: DbUnit[];
};

export type DbCompleted = {
  stars: number;
  completedAt: string;
};

export type DbSession = {
  id: string;
  userId: string;
  courseSlug: string;
  unitId: string;
  createdAt: string;
  durationSec: number;
  /** 每题是否一次答对，长度与单元题目数一致 */
  results: boolean[];
};

export type DbUser = {
  id: string;
  name: string;
  level: Level;
  activeCourseSlug: string;
  starsGoal: number;
  /** 历史累计星，加上已完成单元获得的星即为 starTotal */
  starTotalBase: number;
};

export type Db = {
  version: 1;
  seededAt: string;
  user: DbUser;
  courses: DbCourse[];
  progress: {
    completed: Record<string, DbCompleted>;
    sessions: DbSession[];
  };
};

const DEFAULT_DB_PATH = path.join(process.cwd(), '.data', 'aotu-db.json');

function dbPath(): string {
  return process.env.AOTU_DB_PATH ?? DEFAULT_DB_PATH;
}

type Store = {
  db?: Db;
  loading?: Promise<Db>;
  writeChain?: Promise<void>;
};

const globalStore = globalThis as typeof globalThis & { __aotuStore?: Store };
const store: Store = (globalStore.__aotuStore ??= {});

export async function getDb(): Promise<Db> {
  if (store.db) return store.db;
  if (!store.loading) {
    store.loading = (async () => {
      const file = dbPath();
      try {
        const raw = await fs.readFile(/*turbopackIgnore: true*/ file, 'utf8');
        const parsed = JSON.parse(raw) as Db;
        if (parsed.version !== 1) {
          throw new Error(`Unsupported db version: ${String(parsed.version)}`);
        }
        store.db = parsed;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const seeded = seedDb();
        store.db = seeded;
        await persistDb(seeded);
      }
      if (!store.db) throw new Error('db initialization failed');
      return store.db;
    })().catch((error) => {
      // 允许下一次请求重试（例如首次写盘失败）
      store.loading = undefined;
      throw error;
    });
  }
  return store.loading;
}

/** 排队落盘：同一时刻只有一个写入，快照在入队时生成以保证顺序 */
export async function persistDb(db: Db): Promise<void> {
  const snapshot = JSON.stringify(db, null, 2);
  const file = dbPath();
  store.writeChain = (store.writeChain ?? Promise.resolve()).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, snapshot, 'utf8');
    await fs.rename(tmp, file);
  });
  await store.writeChain;
}
