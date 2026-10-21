'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconSprite } from '@/components/icon-sprite';
import { fetchUnit } from '@/lib/api-client';
import styles from './done.module.css';

type Params = Promise<{ unitId: string }>;

export default function DonePage({ params }: { params: Params }) {
  const { unitId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnit(unitId)
      .then(({ unit }) => {
        if (!cancelled) setTitle(unit.titleZh);
      })
      .catch(() => {
        // 结算页标题只是锦上添花，单元名取不到也不阻塞
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const starsParam = Number(search.get('stars'));
  const stars = Number.isFinite(starsParam) ? Math.min(3, Math.max(1, starsParam)) : 1;

  // 星星逐颗落下：每颗延迟 220ms
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= stars) window.clearInterval(id);
    }, 220);
    return () => window.clearInterval(id);
  }, [stars]);

  return (
    <div className={styles.app}>
      <IconSprite />

      <main className={styles.card}>
        <p className={styles.eyebrow}>这一关完成了</p>
        <h1 className={styles.title}>{title ?? '本关'}</h1>

        <div className={styles.stars} aria-label={`获得 ${stars} 颗星`}>
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              className={`${styles.star} ${i < shown ? styles.on : ''}`}
              style={{ animationDelay: `${i * 220}ms` }}
              aria-hidden="true"
            >
              <use href="#i-star" />
            </svg>
          ))}
        </div>

        <p className={styles.note}>
          {stars === 3
            ? '全部一次答对，太棒了！'
            : stars === 2
              ? '很不错，再稳一点就满星。'
              : '完成就是进步，明天再来。'}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => router.push('/learn')}>
            回到地图
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => router.push(`/learn/unit/${unitId}`)}
          >
            再玩一次
          </button>
        </div>
      </main>
    </div>
  );
}
