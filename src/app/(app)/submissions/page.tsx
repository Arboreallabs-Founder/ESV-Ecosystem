import { redirect } from 'next/navigation'

/**
 * Folded into My Companies.
 *
 * This page listed only the entries that arrived through a partner's *link* — it filtered on
 * `form_link_id` — while a company typed straight into My Companies has no link and so never
 * appeared. Two pages showing overlapping subsets of one list, and the one in the nav was the
 * subset that read as empty for anyone who types their referrals in.
 *
 * My Companies is the whole picture: both routes, one queue, one stage on each card. The redirect
 * stays so bookmarks and any link already sent out still land somewhere useful.
 */
export default async function SubmissionsPage() {
  redirect('/my-companies')
}
