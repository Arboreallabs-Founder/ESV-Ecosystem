import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAssociateReferralForm, fetchMySourcedEntries, fetchMyReferralProgress } from '@/lib/associate-referrals'
import PhaseBar from '@/app/_components/PhaseBar'
import type { ProjectStage } from '@/lib/project-model'
import ReferralLinkCard from '@/app/_components/ReferralLinkCard'
import { WikiButton } from '@/app/_components/WikiPanel'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from './referrals.module.css'

export default async function ReferralsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const [form, sourced, progress] = await Promise.all([
    fetchAssociateReferralForm(),
    fetchMySourcedEntries(),
    // Every pipeline, not just ESV Referrals: anything your link brought in, and where it is now.
    fetchMyReferralProgress(),
  ])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Refer to ESV</div>
            <WikiButton sectionKey="referrals" />
          </div>
          <div className={styles.pageSub}>
            One link, shareable anywhere — LinkedIn, email, a text. Founders fill it in about their
            own startup, and every submission comes back credited to you.
          </div>
        </div>
      </div>

      <ReferralLinkCard
        userId={user.id}
        initialToken={form?.myToken ?? null}
        initialSlug={form?.mySlug ?? null}
        pipelineId={form?.pipelineId ?? null}
        sourcedCount={sourced.length}
      />

      {progress.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Where your referrals are</div>
          <div className={styles.progressGrid}>
            {progress.map((p) => {
              const at = p.stages.findIndex((s) => s.id === p.stage_id)
              return (
                <div key={p.id} className={styles.progressCard}>
                  <div className={styles.progressHead}>
                    <div>
                      <div className={styles.cardName}>{p.title ?? 'Untitled'}</div>
                      <div className={styles.cardMeta}>
                        {p.pipeline_name} · {p.submitter_name ? `${p.submitter_name} · ` : ''}{formatDateTimeIst(p.submitted_at)}
                      </div>
                    </div>
                    <span className={`${styles.stage} ${p.rejected ? styles.stageRejected : ''}`}>
                      {p.rejected ? 'Not taken forward' : at >= 0 ? p.stages[at].name : 'Received'}
                    </span>
                  </div>
                  {!p.rejected && p.stages.length > 0 && (
                    <PhaseBar
                      stage={(p.stage_id ?? '') as ProjectStage}
                      variant="detailed"
                      steps={p.stages.map((s) => ({ key: s.id, label: s.name }))}
                    />
                  )}
                  {p.rejected && p.rejection_reason && <div className={styles.cardMeta}>{p.rejection_reason}</div>}
                </div>
              )
            })}
          </div>
        </>
      )}
      {/* Before the referral-progress migration runs, fall back to the simple list. */}
      {progress.length === 0 && sourced.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Founders who came in through your link</div>
          <div className={styles.list}>
            {sourced.map((s) => (
              <div key={s.id} className={styles.card}>
                <div>
                  <div className={styles.cardName}>{s.title ?? 'Untitled'}</div>
                  <div className={styles.cardMeta}>
                    {s.submitter_name ? `${s.submitter_name} · ` : ''}{formatDateTimeIst(s.submitted_at)}
                  </div>
                </div>
                <span className={styles.stage}>{s.stage?.name ?? 'Lead'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
