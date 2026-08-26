import { createClient } from '@/lib/supabase/server'
import FounderListClient from './_components/FounderListClient'
import styles from './founder-list.module.css'

/**
 * The founder's view of an investor list. Public — no account, the token is the only key.
 *
 * Fund name and website only, by explicit instruction. The founder is deciding who may be
 * approached, not evaluating funds, and showing ticket sizes and sector focus would turn a
 * five-minute review into a research exercise.
 */
export default async function FounderListPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const [{ data, error }, { data: namesData }] = await Promise.all([
    supabase.rpc('get_investor_list_public', { p_token: token }),
    // What they told us last time. Without it a second visit shows an empty form and asks them to
    // remember what they already said.
    supabase.rpc('get_investor_list_names', { p_token: token }),
  ])

  if (error || !data || data.length === 0) {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <h1 className={styles.deadTitle}>This link isn&apos;t active</h1>
          <p className={styles.deadBody}>
            It may have been withdrawn, or the list may not have been shared yet. Reply to whoever
            sent it and they can send a fresh one.
          </p>
        </div>
      </div>
    )
  }

  const head = data[0] as any
  const items = (data as any[])
    .filter((r) => r.item_id)
    .map((r) => ({
      id: r.item_id as string,
      name: r.investor_name as string,
      website: (r.investor_website as string | null) ?? null,
      approved: r.approved as boolean,
      // Every item is stamped decided_at when the founder submits, so one still NULL on a list
      // that has been responded to is a fund that arrived after they last looked.
      isNew: Boolean(head.responded_at) && !r.decided_at,
    }))

  // Recording the open is best-effort: if it fails the founder still sees their list.
  try { await supabase.rpc('mark_investor_list_viewed', { p_token: token }) } catch { /* noop */ }

  return (
    <FounderListClient
      token={token}
      listName={head.list_name}
      dealName={head.deal_name}
      introNote={head.intro_note}
      alreadyResponded={Boolean(head.responded_at)}
      priorNote={head.founder_note ?? null}
      priorExclusions={((namesData as any[]) ?? []).filter((n) => n.kind === 'exclude')
        .map((n) => ({ name: n.name as string, reason: (n.reason as string) ?? '' }))}
      priorSuggestions={((namesData as any[]) ?? []).filter((n) => n.kind === 'include')
        .map((n) => ({ name: n.name as string, reason: (n.reason as string) ?? '' }))}
      items={items}
    />
  )
}
