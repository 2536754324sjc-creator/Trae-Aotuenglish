'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LearnMap } from '@/components/learn-map/learn-map';
import { LearnTopbar } from '@/components/learn-map/learn-topbar';
import { IconSprite } from '@/components/icon-sprite';
import { UnitSheet } from '@/components/unit-sheet';
import { PauseCard } from '@/components/pause-card';
import { fetchProgress } from '@/lib/api-client';
import type { TodayProgress, Unit } from '@/lib/types';
import styles from './learn.module.css';

export default function LearnPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<TodayProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProgress()
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '学习进度加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className={styles.app}>
        <IconSprite />
        <main className={styles.stage}>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            重试
          </button>
        </main>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className={styles.app}>
        <IconSprite />
        <main className={styles.stage}>
          <p>正在加载学习地图…</p>
        </main>
      </div>
    );
  }

  const handleSelect = (unit: Unit) => {
    if (unit.status === 'locked') return;
    setActiveUnit(unit);
  };

  const handleStart = (unit: Unit) => {
    setActiveUnit(null);
    router.push(`/learn/unit/${unit.unitId}`);
  };

  return (
    <div className={styles.app}>
      <IconSprite />
      <LearnTopbar progress={progress} onPause={() => setPaused(true)} />
      <main className={styles.stage}>
        <h1 className="sr-only">{progress.learnerName} 的学习地图</h1>
        <LearnMap progress={progress} onSelectUnit={handleSelect} />
      </main>

      <UnitSheet unit={activeUnit} onClose={() => setActiveUnit(null)} onStart={handleStart} />
      <PauseCard open={paused} progress={progress} onClose={() => setPaused(false)} />
    </div>
  );
}
