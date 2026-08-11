'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FUNDRAISE_STATUS_LABELS, FUNDRAISE_STATUS_COLORS } from '@/lib/types'
import type { FundraiseDisplayStatus } from '@/lib/types'
import styles from '../fundraise-public.module.css'

/**
 * The founder's view of their own raise.
 *
 * Deliberately not the internal page with things hidden — it is a different document. They get the
 * headline of each fund, whatever we chose to tell them, and somewhere to reply. Everything about
 * how we work the fund stays on our side.
 */

type Update = { id: string; kind: string; body: string | null; author: string | null; at: string }
type Entry = {
  id: string
  name: string
  website: string | null
  status: FundraiseDisplayStatus
  status_since: string
  rejection_reason: string | null
  updates: Update[]
}
type Data = { list_id: string; company_name: string | null; shared_at: string | null; entries: Entry[] }

/** The order a founder reads it in: live conversations first, answers last. */
const ORDER: FundraiseDisplayStatus[] = [
  'accepted', 'due_diligence', 'call_request', 'data_requested', 'deal_sent',
  'not_sent', 'ghosted', 'rejected', 'closed',
]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function FundraisePublicClient({ data, token }: { data: Data; token: string }) {
  const [entries, setEntries] = useState(data.entries)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const sorted = [...entries].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name),
  )

  const live = entries.filter((e) =>
    ['deal_sent', 'data_requested', 'call_request', 'due_diligence'].includes(e.status)).length
  const accepted = entries.filter((e) => e.status === 'accepted').length

  function comment(entryId: string) {
    const body = (draft[entryId] ?? '').trim()
    if (!body) return
    setError(null)
    start(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.rpc('add_fundraise_founder_comment', {
        p_token: token, p_entry_id: entryId, p_body: body,
      })
      if (err) { setError(err.message); return }
      // Shown immediately rather than after a reload: they have just written it, and watching it
      // vanish into a spinner is how people write it twice.
      setEntries((prev) => prev.map((e) => e.id === entryId
        ? { ...e, updates: [...e.updates, {
            id: `local-${Date.now()}`, kind: 'founder_comment', body, author: 'You',
            at: new Date().toISOString(),
          }] }
        : e))
      setDraft((d) => ({ ...d, [entryId]: '' }))
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.head}>
          <div className={styles.brand}>
            <span className={styles.brandDot} />
            Earlyseed Ventures
          </div>
          <h1 className={styles.title}>
            {data.company_name ? `${data.company_name} — fundraise status` : 'Fundraise status'}
          </h1>
          <p className={styles.sub}>
            Where each fund has got to. Add a comment against any of them — we see it against that
            fund, so you do not have to explain which one you mean.
          </p>
          <div className={styles.tally}>
            <strong>{live}</strong> in conversation
            {accepted > 0 && <> · <strong>{accepted}</strong> accepted</>}
            {' '}· <strong>{entries.length}</strong> total
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <ul className={styles.list}>
          {sorted.map((e) => (
            <li key={e.id} className={styles.row}>
              <div className={styles.rowHead}>
                <div className={styles.rowName}>
                  {e.website
                    ? <a href={e.website} target="_blank" rel="noopener noreferrer" className={styles.rowLink}>{e.name}</a>
                    : e.name}
                </div>
                <span
                  className={styles.status}
                  style={{
                    color: FUNDRAISE_STATUS_COLORS[e.status],
                    borderColor: `${FUNDRAISE_STATUS_COLORS[e.status]}55`,
                    background: `${FUNDRAISE_STATUS_COLORS[e.status]}12`,
                  }}
                >
                  {FUNDRAISE_STATUS_LABELS[e.status]}
                </span>
              </div>

              {/* A rejection always carries its reason. "They passed" on its own is the answer that
                  helps nobody. */}
              {e.rejection_reason && (
                <p className={styles.reason}><strong>Why:</strong> {e.rejection_reason}</p>
              )}

              {e.updates.length > 0 && (
                <div className={styles.updates}>
                  {e.updates.map((u) => (
                    <div key={u.id} className={u.kind === 'founder_comment' ? styles.mine : styles.update}>
                      <span className={styles.updateMeta}>
                        {u.kind === 'founder_comment' ? (u.author ?? 'You') : 'Earlyseed'} · {fmt(u.at)}
                      </span>
                      {u.body && <p className={styles.updateBody}>{u.body}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.commentRow}>
                <input
                  className={styles.input}
                  value={draft[e.id] ?? ''}
                  onChange={(ev) => setDraft((d) => ({ ...d, [e.id]: ev.target.value }))}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') comment(e.id) }}
                  placeholder={`Anything about ${e.name}?`}
                />
                <button
                  className={styles.sendBtn}
                  disabled={pending || !(draft[e.id] ?? '').trim()}
                  onClick={() => comment(e.id)}
                >
                  Send
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className={styles.foot}>
          This page updates as we do. Nothing here is shared outside Earlyseed Ventures and you.
        </p>
      </div>
    </div>
  )
}
