'use client';

import { useEffect, useState } from 'react';
import { Table, Segmented, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DailyMinutesChart } from '@/features/parent/daily-minutes-chart';
import { MasteryBars } from '@/features/parent/mastery-bars';
import { fetchProgress, fetchWeeklyReport } from '@/lib/api-client';
import { isoWeekKey, shiftWeek } from '@/lib/date';
import type { ReportRow, WeeklyReportResponse } from '@/lib/types';
import styles from './report.module.css';

const detailColumns: ColumnsType<ReportRow> = [
  { title: '日期', dataIndex: 'day', key: 'day', width: 90 },
  { title: '单元', dataIndex: 'unit', key: 'unit' },
  {
    title: '题目数',
    dataIndex: 'questions',
    key: 'questions',
    width: 90,
    align: 'right',
  },
  {
    title: '正确率',
    dataIndex: 'accuracy',
    key: 'accuracy',
    width: 100,
    align: 'right',
    render: (v: number) => `${v}%`,
  },
  {
    title: '时长',
    dataIndex: 'minutes',
    key: 'minutes',
    width: 80,
    align: 'right',
    render: (v: number) => `${v} 分钟`,
  },
];

export default function ParentReportPage() {
  const [thisWeek] = useState(() => isoWeekKey());
  const [week, setWeek] = useState(thisWeek);
  const [data, setData] = useState<WeeklyReportResponse | null>(null);
  const [learnerName, setLearnerName] = useState('孩子');
  const [error, setError] = useState<string | null>(null);

  const options = [
    { label: '本周', value: thisWeek },
    { label: '上周', value: shiftWeek(thisWeek, -1) },
    { label: '更早', value: shiftWeek(thisWeek, -2) },
  ];
  const weekTitle = options.find((item) => item.value === week)?.label ?? '周报';

  useEffect(() => {
    let cancelled = false;
    fetchProgress()
      .then((progress) => {
        if (!cancelled) setLearnerName(progress.learnerName);
      })
      .catch(() => {
        // 姓名取不到不影响周报主体
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchWeeklyReport(week)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '周报加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [week]);

  const report = data?.report;
  const rows = data?.rows ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>
            {weekTitle} · {learnerName}
          </h1>
          <p className={styles.range}>{report?.weekLabel ?? '—'}</p>
        </div>
        <Segmented
          value={week}
          onChange={(value) => setWeek(String(value))}
          options={options}
          className={styles.weeks}
        />
      </header>

      {error ? (
        <section className={styles.block}>
          <p className={styles.none}>{error}</p>
        </section>
      ) : !report ? (
        <section className={styles.block}>
          <p className={styles.none}>正在加载周报…</p>
        </section>
      ) : (
        <>
          {/* 一屏主角：三个数字，不是三张卡 */}
          <section className={styles.stats} aria-label="本周概览">
            <div className={styles.stat}>
              <span className={styles.statValue}>{report.minutes}</span>
              <span className={styles.statLabel}>学习分钟</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {report.unitsDone}
                <span className={styles.statDivider}>/</span>
                {report.unitsTotal}
              </span>
              <span className={styles.statLabel}>完成单元</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{report.streakDays}</span>
              <span className={styles.statLabel}>连续天数</span>
            </div>
          </section>

          {/* 趋势 */}
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>每日时长</h2>
            <DailyMinutesChart data={report.dailyMinutes} />
          </section>

          {/* 短板 */}
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>薄弱环节</h2>
            {report.weakSounds.length > 0 ? (
              <ul className={styles.weak}>
                {report.weakSounds.map((w) => (
                  <li key={w.sound} className={styles.weakItem}>
                    <span className={styles.sound}>{w.sound}</span>
                    <span className={styles.weakNote}>{w.noteZh}</span>
                    <Button
                      type="primary"
                      size="small"
                      className={styles.weakBtn}
                      href="/learn"
                    >
                      去练一练
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.none}>暂未发现明显薄弱项</p>
            )}
          </section>

          {/* 掌握 */}
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>单元掌握</h2>
            <MasteryBars data={report.unitMastery} />
          </section>

          {/* 明细 */}
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>明细</h2>
            <Table<ReportRow>
              columns={detailColumns}
              dataSource={rows}
              rowKey={(r) => r.day + r.unit}
              pagination={false}
              size="middle"
              className={styles.table}
            />
          </section>
        </>
      )}
    </div>
  );
}
