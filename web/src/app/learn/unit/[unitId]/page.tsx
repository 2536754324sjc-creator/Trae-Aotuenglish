'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconSprite } from '@/components/icon-sprite';
import { fetchUnit, postSession } from '@/lib/api-client';
import type { Unit } from '@/lib/types';
import { useAnswerMachine } from '@/features/learn/use-answer-machine';
import { PictureChoice } from '@/features/learn/picture-choice';
import { TapCard } from '@/features/learn/tap-card';
import { TextChoice } from '@/features/learn/text-choice';
import { getDict } from '@/i18n';
import styles from './unit.module.css';

const t = getDict('zh');

type Params = Promise<{ unitId: string }>;

export default function UnitPage({ params }: { params: Params }) {
  const { unitId } = use(params);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnit(unitId)
      .then(({ unit: data }) => {
        if (!cancelled) setUnit(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '这一关加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (error) {
    return (
      <div className={styles.missing}>
        <IconSprite />
        <p>{error}</p>
        <Link href="/learn">回到学习地图</Link>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className={styles.missing}>
        <IconSprite />
        <p>正在加载这一关…</p>
      </div>
    );
  }

  return <UnitRunner unit={unit} />;
}

function UnitRunner({ unit }: { unit: Unit }) {
  const router = useRouter();
  const [quitOpen, setQuitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const submitted = useRef(false);
  const machine = useAnswerMachine(unit);

  /** 答完先上报，再带着后端算出的星星进结算；上报失败也不阻塞孩子 */
  const goDone = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);

    let stars = machine.stars;
    try {
      const result = await postSession({
        unitId: unit.unitId,
        results: machine.state.results,
        durationSec: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
      });
      stars = result.stars;
    } catch (err) {
      console.error('[learn] 练习结果上报失败，使用本地星星数', err);
    }

    router.push(`/learn/unit/${unit.unitId}/done?stars=${stars}`);
  }, [machine.stars, machine.state.results, router, unit.unitId]);

  // 答完全部题后自动进结算，给孩子明确的「完成」感
  useEffect(() => {
    if (!machine.state.finished) return;
    void goDone();
  }, [machine.state.finished, goDone]);

  const q = machine.question;
  const progressPct = (machine.state.index / machine.total) * 100;

  return (
    <div className={styles.app}>
      <IconSprite />

      <header className={styles.bar}>
        <button
          type="button"
          className={styles.close}
          aria-label={t.common.close}
          onClick={() => setQuitOpen(true)}
        >
          <svg aria-hidden="true">
            <use href="#i-close" />
          </svg>
        </button>

        <div
          className={styles.progress}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={machine.total}
          aria-valuenow={machine.current}
          aria-label={`第 ${machine.current} 题，共 ${machine.total} 题`}
        >
          <span style={{ width: `${progressPct}%` }} />
        </div>

        <span className={styles.counter}>
          {machine.current}/{machine.total}
        </span>
      </header>

      <main className={styles.stage}>
        <p className={styles.prompt}>{q?.promptZh ?? '这一关已经完成'}</p>

        <div className={styles.choice}>
          {q?.type === 'listen_choose_image' && (
            <PictureChoice
              options={q.options}
              selected={machine.state.selected}
              // 只有答对才锁卡片；答错必须能重新选
              disabled={machine.state.phase === 'correct'}
              revealed={machine.state.phase === 'correct'}
              onSelect={machine.select}
              audioText={q.audioText}
            />
          )}
          {q?.type === 'tap_to_read' && (
            <TapCard
              key={q.id}
              options={q.options}
              audioText={q.audioText}
              selected={machine.state.selected}
              disabled={machine.state.phase === 'correct'}
              onSelect={machine.select}
            />
          )}
          {(q?.type === 'read_choose' || q?.type === 'cloze') && (
            <TextChoice
              key={q.id}
              options={q.options}
              selected={machine.state.selected}
              disabled={machine.state.phase === 'correct'}
              revealed={machine.state.phase === 'correct'}
              onSelect={machine.select}
              audioText={q.audioText}
            />
          )}
          {q &&
            q.type !== 'listen_choose_image' &&
            q.type !== 'tap_to_read' &&
            q.type !== 'read_choose' &&
            q.type !== 'cloze' && (
              <p className={styles.unsupported}>这一题型还在做（{q.type}）</p>
            )}
        </div>

        <div
          className={`${styles.feedback} ${machine.showRetryHint ? styles.retry : ''}`}
          role="status"
          aria-live="polite"
        >
          {machine.state.phase === 'correct' && <span className={styles.good}>{t.learn.correct}</span>}
          {machine.showRetryHint && <span>{t.learn.wrongHint}</span>}
        </div>
      </main>

      <footer className={styles.footer}>
        {machine.state.finished || submitting ? (
          <button type="button" className={styles.primary} disabled>
            {submitting ? '正在保存…' : '完成'}
          </button>
        ) : machine.state.phase === 'correct' ? (
          <button type="button" className={styles.primary} onClick={machine.next}>
            {t.common.next}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={!machine.canCheck}
            onClick={machine.check}
          >
            {t.common.check}
          </button>
        )}
      </footer>

      {quitOpen && (
        <div className={styles.quitWrap}>
          <div
            className={styles.quitCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quit-title"
          >
            <h2 id="quit-title">{t.learn.quitTitle}</h2>
            <p>{t.learn.quitDesc}</p>
            <div className={styles.quitActions}>
              <button type="button" className={styles.primary} onClick={() => setQuitOpen(false)}>
                {t.learn.quitStay}
              </button>
              <button type="button" className={styles.ghost} onClick={() => router.push('/learn')}>
                {t.learn.quitConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
