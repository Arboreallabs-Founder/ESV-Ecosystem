import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import Link from 'next/link'
import {
  fetchAssignableForSgp, isSgpCoordinator, isSgpApprover, fetchPartnerPipeline, fetchPartnerQueue,
  fetchInvestorReferralQueue, fetchAttributionClaims,
} from '@/lib/partner-companies'
import SgpDeskClient, { type QueueEntry } from './_components/SgpDeskClient'
import InvestorReferralQueue from './_components/InvestorReferralQueue'
import AttributionQueue from './_components/AttributionQueue'
import styles from './sgp-desk.module.css'

/**
 * The SGP Desk — partner-sourced companies awaiting triage.
 *
 * Reachable by founders and admins, and by any associate flagged as an SGP Coordinator. An
 * associate without the flag has no reason to see other partners' leads, so they are redirected
 * rather than shown an empty queue.
 *
 * One list. It used to fetch partner_companies as well and render both, which showed every
 * submission twice — 20260906 moved intake onto the pipeline and carried the old rows across, so
 * the second list was a frozen duplicate that could never receive anything new.
 */
export default async function SgpDeskPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  const isLead = ['founder', 'admin'].includes(user.role ?? '')
  const coordinator = isLead ? true : await isSgpCoordinator(user.id)
  const approver = await isSgpApprover(user.id)
  // The founder approver reaches the Desk on the strength of that flag alone: the whole point is
  // that the second signature is one named person, and requiring them to also be a coordinator
  // would mean the person signing off is a person who could have signed off already.
  if (!coordinator && !approver) redirect('/dashboard')

  // In flight together: none of these depends on another, and each is a round trip to ap-south-1.
  const [assignable, pipeline, queue, investorReferrals, claims] = await Promise.all([
    fetchAssignableForSgp(),
    fetchPartnerPipeline(),
    fetchPartnerQueue(),
    fetchInvestorReferralQueue(),
    fetchAttributionClaims(),
  ])

  const waiting = (queue as QueueEntry[]).filter((e) => e.stage?.stage_type === 'lead')

  return (
    <>
      {pipeline && (
        <div className={styles.pipelineBar}>
          <div>
            <div className={styles.pipelineTitle}>
              {waiting.length} waiting on the {pipeline.name} pipeline
            </div>
            <div className={styles.pipelineSub}>
              {queue.length} partner submission{queue.length === 1 ? '' : 's'} in total. Deciding here
              moves the card; so does dragging it on the board.
            </div>
          </div>
          <Link href={`/pipelines/${pipeline.id}`} className={styles.pipelineBtn}>
            Open the board
          </Link>
        </div>
      )}
      {/* Approval first. On the Monday call this is the decision that has money attached; triage
          and the referral queue are work that can happen any day of the week. */}
      <AttributionQueue claims={claims} canCoordinate={coordinator} canApprove={approver} />
      <InvestorReferralQueue referrals={investorReferrals} />
      <SgpDeskClient entries={queue as QueueEntry[]} assignable={assignable} />
    </>
  )
}
