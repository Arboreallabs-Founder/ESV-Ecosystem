'use client'

import type { Kudos } from '@/lib/types'
import { artFor } from './kudos-meta'
import Avatar from '@/app/_components/Avatar'
import styles from '../engage.module.css'

/* Fixed, not randomised — random positions would differ between the server and client render
   and trip a hydration mismatch. Tuned by hand to scatter naturally. */
const CONFETTI = [
  { left: '38%', top: '9%', size: 9, rot: -20, color: '#7C5CF0' },
  { left: '52%', top: '13%', size: 8, rot: 35, color: '#F0A93B' },
  { left: '44%', top: '20%', size: 6, rot: 10, color: '#5B9DF9' },
  { left: '62%', top: '7%', size: 7, rot: -45, color: '#FFD98A' },
  { left: '30%', top: '26%', size: 5, rot: 15, color: '#4B3BA8' },
  { left: '58%', top: '24%', size: 6, rot: -30, color: '#B9A6FF' },
  { left: '86%', top: '11%', size: 8, rot: 55, color: '#FFD98A' },
  { left: '92%', top: '20%', size: 6, rot: -15, color: '#FFFFFF' },
  { left: '47%', top: '62%', size: 7, rot: 25, color: '#5B9DF9' },
  { left: '36%', top: '72%', size: 6, rot: -40, color: '#F0A93B' },
  { left: '56%', top: '78%', size: 5, rot: 18, color: '#9BE6DC' },
  { left: '68%', top: '68%', size: 6, rot: -22, color: '#B9A6FF' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function KudosCard({ kudos }: { kudos: Kudos }) {
  const art = artFor(kudos.category)

  return (
    <article className={styles.kCard} style={{ background: art.gradient }}>
      {/* Decorative layer — purely presentational, hidden from assistive tech. */}
      <div className={styles.kDecor} aria-hidden="true">
        <div className={styles.kGlowA} style={{ background: art.accent }} />
        <div className={styles.kGlowB} />
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className={styles.kConfetti}
            style={{
              left: c.left, top: c.top, width: c.size, height: c.size * 1.4,
              background: c.color, transform: `rotate(${c.rot}deg)`,
              animationDelay: `${(i % 6) * 0.45}s`,
            }}
          />
        ))}
        <div className={styles.kWave} />
        <div className={styles.kRibbonLeft} />
        <div className={styles.kRibbonRight} />
      </div>

      <div className={styles.kTop}>
        <div className={styles.kBadge}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFD98A" aria-hidden="true">
            <path d="M12 2l2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5z" />
          </svg>
          Kudos
        </div>

        <div className={styles.kHeadRow}>
          <div className={styles.kHeadText}>
            <h2 className={styles.kTitle}>{art.label}</h2>
            <div className={styles.kDivider} aria-hidden="true">
              <span className={styles.kDividerLine} />
              <svg width="12" height="12" viewBox="0 0 24 24" fill={art.accent}>
                <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
              </svg>
              <span className={styles.kDividerLine} />
            </div>
            <p className={styles.kTagline}>{art.tagline}</p>
          </div>

          <div className={styles.kMedallion}>
            <div className={styles.kMedallionInner}>{art.icon}</div>
            <span className={styles.kSparkle} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* The actual kudos content, on a darkened plate so the message always stays legible
         regardless of where the gradient lands behind it. */}
      <div className={styles.kBody}>
        <div className={styles.kNames}>
          <span className={styles.kRecipient}>
            <Avatar name={kudos.recipient?.name} photoUrl={kudos.recipient?.photo_url} size="sm" />
            {kudos.recipient?.name ?? 'Someone'}
          </span>
          <span className={styles.kFrom}>
            from <Avatar name={kudos.giver?.name} photoUrl={kudos.giver?.photo_url} size="xs" /> {kudos.giver?.name ?? 'Someone'}
          </span>
        </div>
        <blockquote className={styles.kMessage}>{kudos.message}</blockquote>
        <div className={styles.kDate}>{formatDate(kudos.created_at)}</div>
      </div>
    </article>
  )
}
