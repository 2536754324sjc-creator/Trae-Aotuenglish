import type { Metadata } from 'next';
import Link from 'next/link';
import { LearnMap } from '@/components/learn-map/learn-map';
import { IconSprite } from '@/components/icon-sprite';
import { getProgress, listCourses } from '@/lib/server/courses';
import { levels } from '@/design/tokens';
import { getDict } from '@/i18n';
import styles from './home.module.css';

const t = getDict('zh');

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AotuEnglish · 每天 15 分钟，真的开口',
  description:
    '一张看得见进度的英语学习地图。4 岁到成人，按内容分层闯关，家长看得见每周进步。',
};

export default async function HomePage() {
  const [progress, courses] = await Promise.all([getProgress(), listCourses()]);

  return (
    <>
      <IconSprite />
      <header className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>A</span>
          <span>{t.common.appName}</span>
        </Link>
        <nav className={styles.links} aria-label="主导航">
          <Link href="/courses">{t.nav.courses}</Link>
          <Link href="/pricing">{t.nav.pricing}</Link>
          <Link href="/help">{t.nav.help}</Link>
        </nav>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.ghost}>
            {t.nav.login}
          </Link>
          <Link href="/trial" className={styles.cta}>
            {t.nav.freeTrial}
          </Link>
        </div>
      </header>

      <main>
        {/* 首屏：标题 + 真实地图切片 */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1>
              每天 15 分钟，
              <br />
              真的开口
            </h1>
            <p>
              一张会走路的地图。每过一关前进一格，答对就有一声回响——
              从 4 岁听音选图，到成人商务场景，同一套路径一路走上去。
            </p>
            <div className={styles.heroActions}>
              <Link href="/trial" className={styles.cta}>
                {t.nav.freeTrial}
              </Link>
              <Link href="/learn" className={styles.link}>
                先看看学习地图 →
              </Link>
            </div>
          </div>

          <div className={styles.heroMap} aria-label="学习地图预览">
            <LearnMap progress={progress} variant="compact" />
          </div>
        </section>

        {/* 三步闭环 */}
        <section className={styles.steps}>
          <h2>三步就走完一圈</h2>
          <ol>
            <li>
              <span className={styles.stepNum}>1</span>
              <strong>今天练什么</strong>
              <p>打开就是今日任务，不用挑、不用选。</p>
            </li>
            <li>
              <span className={styles.stepNum}>2</span>
              <strong>闯过去</strong>
              <p>一屏一题，图大字少，答错可以再试。</p>
            </li>
            <li>
              <span className={styles.stepNum}>3</span>
              <strong>拿到星星</strong>
              <p>星星攒够开宝箱，地图上看得见自己走到了哪。</p>
            </li>
          </ol>
        </section>

        {/* 内容分层 */}
        <section className={styles.levels}>
          <h2>同一个产品，四个档</h2>
          <p className={styles.sectionLead}>
            不限年龄。起点不同，密度就不同——图卡变小、文字变多、语气变平，路径还是一样。
          </p>
          <div className={styles.levelGrid}>
            {Object.entries(levels).map(([key, cfg]) => (
              <div key={key} className={styles.levelCard}>
                <span className={styles.levelAge}>{cfg.label}</span>
                <span className={styles.levelMeta}>每单元约 {cfg.questionsPerUnit} 题</span>
              </div>
            ))}
          </div>
        </section>

        {/* 课程 */}
        <section className={styles.courses}>
          <h2>内容体系</h2>
          <div className={styles.courseGrid}>
            {courses.map((c) => (
              <Link key={c.slug} href={`/courses/${c.slug}`} className={styles.courseCard}>
                <span className={styles.courseTag}>{levels[c.level].label}</span>
                <strong>{c.titleZh}</strong>
                <span className={styles.courseEn}>{c.titleEn}</span>
                <span className={styles.courseMeta}>{c.unitCount} 个单元</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 结尾行动 */}
        <section className={styles.finalCta}>
          <h2>先玩一关，再说要不要学</h2>
          <p>不用注册就能试，玩完觉得合适再留下记录。</p>
          <Link href="/trial" className={styles.ctaBig}>
            {t.nav.freeTrial}
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()} {t.common.appName}
        </span>
        <span>字体 Baloo 2 / ZCOOL KuaiLe / Noto Sans SC，SIL OFL 1.1</span>
      </footer>
    </>
  );
}
