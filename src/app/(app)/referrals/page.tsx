import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAssociateReferralForm, fetchMySourcedEntries } from '@/lib/associate-referrals'
import ReferralLinkCard from '@/app/_components/ReferralLinkCard'
import { WikiButton } from '@/app/_components/WikiPanel'
import { formatDateTimeIst } from '@/lib/format-datetime'
import styles from './referrals.module.css'

export default async function ReferralsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  const [form, sourced] = await Promise.all([
    fetchAssociateReferralForm(),
    fetchMySourcedEntries(),
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
            One link, shareable anywhere — LinkedIn, email, a text. Whoever fills it in submits
            themselves, and it comes back credited to you.
          </div>
        </div>
      </div>

      <ReferralLinkCard
        initialToken={form?.myToken ?? null}
        pipelineId={form?.pipelineId ?? null}
        sourcedCount={sourced.length}
      />

      {sourced.length > 0 && (
        <>
          <div className={styles.sectionTitle}>What you&apos;ve sourced</div>
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
