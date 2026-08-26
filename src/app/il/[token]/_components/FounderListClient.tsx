'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '../founder-list.module.css'

type Item = { id: string; name: string; website: string | null; approved: boolean; isNew: boolean }
type NameRow = { name: string; reason: string }

/**
 * Everything starts ticked. The founder is removing objections, not building a list from scratch —
 * an empty list they have to fill in comes back empty.
 */
export default function FounderListClient({
  token, listName, dealName, introNote, alreadyResponded,
  priorNote, priorExclusions, priorSuggestions, items: initial,
}: {
  token: string
  listName: string
  dealName: string
  introNote: string | null
  alreadyResponded: boolean
  /** What they told us last time, so a second visit is an edit rather than a blank form. */
  priorNote: string | null
  priorExclusions: NameRow[]
  priorSuggestions: NameRow[]
  items: Item[]
}) {
  const [items, setItems] = useState(initial)
  const [exclusions, setExclusions] = useState<NameRow[]>(priorExclusions)
  const [suggestions, setSuggestions] = useState<NameRow[]>(priorSuggestions)
  const [note, setNote] = useState(priorNote ?? '')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const approved = items.filter((i) => i.approved).length
  const declined = items.length - approved
  const newCount = items.filter((i) => i.isNew).length

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
        p_suggestions: suggestions.filter((e) => e.name.trim()),
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
            {suggestions.filter((e) => e.name.trim()).length > 0
              && ' We’ll look up the funds you suggested and add the ones we can reach.'}
          </p>
          {/* A dead end here is why founders used to reply by email to change one name. The
              submission replaces the previous answer wholesale, so going back round is safe. */}
          <button type="button" className={styles.editAgain} onClick={() => setDone(false)}>
            Change my answer
          </button>
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
                {/* They approved a list; this one was not in it. Saying so is the difference
                    between adding a fund and slipping one past them. */}
                {i.isNew && <span className={styles.newChip}>Added since you last looked</span>}
              </label>
              {i.website && (
                <a href={i.website} target="_blank" rel="noopener noreferrer" className={styles.rowLink}>
                  {i.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
            </li>
          ))}
        </ul>

        {alreadyResponded && newCount > 0 && (
          <div className={styles.newBanner}>
            <strong>{newCount} {newCount === 1 ? 'fund has' : 'funds have'} been added</strong> since
            you last replied — marked below. Have a look and send again to confirm.
          </div>
        )}

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

        {/* The positive list. Founders were already replying "also try X" by email, which is the
            exact place this page exists to get the conversation out of. */}
        <section className={styles.negative}>
          <h2 className={styles.negTitle}>Anyone we&apos;ve missed?</h2>
          <p className={styles.negSub}>
            Funds you&apos;d like us to approach that aren&apos;t on the list. A name is enough —
            we&apos;ll work out who you mean and come back if we can&apos;t.
          </p>
          {suggestions.map((e, idx) => (
            <div key={idx} className={styles.negRow}>
              <input
                className={styles.input}
                value={e.name}
                onChange={(ev) => setSuggestions((p) => p.map((x, i) => i === idx ? { ...x, name: ev.target.value } : x))}
                placeholder="Fund or investor name"
              />
              <input
                className={styles.input}
                value={e.reason}
                onChange={(ev) => setSuggestions((p) => p.map((x, i) => i === idx ? { ...x, reason: ev.target.value } : x))}
                placeholder="Why, or who you know there (optional)"
              />
              <button
                type="button"
                className={styles.rowBtn}
                onClick={() => setSuggestions((p) => p.filter((_, i) => i !== idx))}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setSuggestions((p) => [...p, { name: '', reason: '' }])}
          >
            + Suggest a fund
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
          You can change your mind — this link stays open, and sending again replaces your
          previous answer.
        </p>
      </div>
    </div>
  )
}
