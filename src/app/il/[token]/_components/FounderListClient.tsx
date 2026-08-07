'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '../founder-list.module.css'

type Item = { id: string; name: string; website: string | null; approved: boolean }

/**
 * Everything starts ticked. The founder is removing objections, not building a list from scratch —
 * an empty list they have to fill in comes back empty.
 */
export default function FounderListClient({
  token, listName, dealName, introNote, alreadyResponded, items: initial,
}: {
  token: string
  listName: string
  dealName: string
  introNote: string | null
  alreadyResponded: boolean
  items: Item[]
}) {
  const [items, setItems] = useState(initial)
  const [exclusions, setExclusions] = useState<Array<{ name: string; reason: string }>>([])
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const approved = items.filter((i) => i.approved).length
  const declined = items.length - approved

  function toggle(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, approved: !i.approved } : i)))
  }

  function submit() {
    setError(null)
    start(async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase.rpc('submit_investor_list_response', {
        p_token: token,
        p_unapproved: items.filter((i) => !i.approved).map((i) => i.id),
        p_exclusions: exclusions.filter((e) => e.name.trim()),
        p_note: note.trim() || null,
      })
      if (err || data === false) {
        setError('That didn’t save. The link may have been withdrawn — please get in touch.')
        return
      }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <h1 className={styles.doneTitle}>Thank you — that&apos;s recorded</h1>
          <p className={styles.doneBody}>
            We&apos;ll approach the {approved} {approved === 1 ? 'fund' : 'funds'} you approved
            {declined > 0 ? `, and leave the other ${declined} alone` : ''}.
            {exclusions.filter((e) => e.name.trim()).length > 0
              && ' We’ve also noted the names you asked us to avoid.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <header className={styles.head}>
          <div className={styles.eyebrow}>Earlyseed Ventures</div>
          <h1 className={styles.title}>{listName}</h1>
          <p className={styles.sub}>Proposed investors for {dealName}</p>
        </header>

        {introNote && <div className={styles.intro}>{introNote}</div>}

        <p className={styles.instruction}>
          These are the funds we&apos;d like to approach. <strong>Everything is ticked by
          default</strong> — untick anyone you&apos;d rather we didn&apos;t contact. You don&apos;t
          need to explain why.
        </p>

        {alreadyResponded && (
          <div className={styles.notice}>
            You&apos;ve answered this once already. Submitting again replaces your previous answer.
          </div>
        )}

        <ul className={styles.list}>
          {items.map((i) => (
            <li key={i.id} className={i.approved ? styles.row : styles.rowOff}>
              <label className={styles.rowLabel}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={i.approved}
                  onChange={() => toggle(i.id)}
                />
                <span className={styles.rowName}>{i.name}</span>
              </label>
              {i.website && (
                <a href={i.website} target="_blank" rel="noopener noreferrer" className={styles.rowLink}>
                  {i.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className={styles.tally}>
          <strong>{approved}</strong> approved
          {declined > 0 && <> · <strong>{declined}</strong> you&apos;d rather we skipped</>}
        </div>

        {/* The negative list: names we would never have thought to put on the list. */}
        <section className={styles.negative}>
          <h2 className={styles.negTitle}>Anyone else we should avoid?</h2>
          <p className={styles.negSub}>
            Investors already on your cap table, someone you&apos;re speaking to directly, or anyone
            you&apos;d rather we stayed away from. They don&apos;t have to be on the list above.
          </p>
          {exclusions.map((e, idx) => (
            <div key={idx} className={styles.negRow}>
              <input
                className={styles.input}
                value={e.name}
                onChange={(ev) => setExclusions((p) => p.map((x, i) => i === idx ? { ...x, name: ev.target.value } : x))}
                placeholder="Fund or investor name"
              />
              <input
                className={styles.input}
                value={e.reason}
                onChange={(ev) => setExclusions((p) => p.map((x, i) => i === idx ? { ...x, reason: ev.target.value } : x))}
                placeholder="Reason (optional)"
              />
              <button
                type="button"
                className={styles.rowBtn}
                onClick={() => setExclusions((p) => p.filter((_, i) => i !== idx))}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setExclusions((p) => [...p, { name: '', reason: '' }])}
          >
            + Add a name
          </button>
        </section>

        <label className={styles.noteBlock}>
          <span className={styles.negTitle}>Anything else?</span>
          <textarea
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Optional"
          />
        </label>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submit} onClick={submit} disabled={pending}>
          {pending ? 'Sending…' : 'Send my answer'}
        </button>
        <p className={styles.foot}>
          You can change your mind — reply to the email and we&apos;ll send the list again.
        </p>
      </div>
    </div>
  )
}
