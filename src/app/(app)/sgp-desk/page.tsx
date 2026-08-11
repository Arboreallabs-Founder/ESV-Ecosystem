import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import Link from 'next/link'
import {
  fetchPartnerCompanies, fetchAssignableForSgp, isSgpCoordinator,
  fetchPartnerPipeline, fetchPartnerQueue,
} from '@/lib/partner-companies'
import SgpDeskClient from './_components/SgpDeskClient'
import styles from './sgp-desk.module.css'

/**
 * The SGP Desk — partner-sourced companies awaiting triage.
 *
 * Reachable by founders and admins, and by any associate flagged as an SGP Coordinator. An
 * associate without the flag has no reason to see other partners' leads, so they are redirected
 * rather than shown an empty queue.
 */
export default async function SgpDeskPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  const isLead = ['founder', 'admin'].includes(user.role ?? '')
  const coordinator = isLead ? true : await isSgpCoordinator(user.id)
  if (!coordinator) redirect('/dashboard')

  const [submissions, assignable, pipeline, queue] = await Promise.all([
    fetchPartnerCompanies(),
    fetchAssignableForSgp(),
    fetchPartnerPipeline(),
    fetchPartnerQueue(),
  ])

  // Everything a partner submits — typed in or through their referral link — is an entry on this
  // pipeline. The board is where the stage actually moves; the Desk is where a coordinator decides
  // what happens and hands it to someone.
  const waiting = queue.filter((e: any) => e.stage?.stage_type === 'lead')

  return (
    <>
      {pipeline && (
        <div className={styles.pipelineBar}>
          <div>
            <div className={styles.pipelineTitle}>
              {waiting.length} waiting on the {pipeline.name} pipeline
            </div>
            <div className={styles.pipelineSub}>
              {queue.length} partner submission{queue.length === 1 ? '' : 's'} in total. Moving a card
              on the board is what updates the partner's own view.
            </div>
          </div>
          <Link href={`/pipelines/${pipeline.id}`} className={styles.pipelineBtn}>
            Open the board
          </Link>
        </div>
      )}
      <SgpDeskClient
        submissions={submissions}
        assignable={assignable}
        currentUserId={user.id}
      />
    </>
  )
}
