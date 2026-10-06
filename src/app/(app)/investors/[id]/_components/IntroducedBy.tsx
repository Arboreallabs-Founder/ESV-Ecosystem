'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { proposeInvestorChain } from '@/app/actions/partner-attribution'
import { searchInvestorsForChain } from '@/app/actions/investors'
import styles from '../../investors.module.css'

/**
 * Who introduced this investor, and the way to say that somebody else's investor did.
 *
 * Two shapes of credit lead here. A partner introduced them directly — the existing
 * referred_by_partner_id, set through the SGP Desk. Or another investor did, which is the branch
 * added in 20261018000000: credit rolls up that chain to whichever partner is at its root, and ESV
 * pays that partner gross of everything below them.
 *
 * Proposing is all this does. The write itself is refused by a database trigger unless it arrives
 * through an approved claim with two signatures, because placing an investor under one of Robin's
 * investors credits Robin exactly as tagging them to Robin would.
 */
export default function IntroducedBy({
  investorId,
  investorName,
  partnerName,
  referrer,
  canPropose,
}: {
  investorId: string
  investorName: string
  /** Set when a partner introduced them directly — the root of a chain. */
  partnerName: string | null
  /** Set when another investor introduced them. */
  referrer: { id: string; name: string } | null
  canPropose: boolean
}) {
  const router = useRouter()
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name: string; root_partner_name: string | null }>>([])
  const [chosen, setChosen] = useState<{ id: string; name: string; root_partner_name: string | null } | null>(null)
  const [note, setNote] = useState('')
  const [searching, startSearch] = useTransition()
  const [filing, startFile] = useTransition()

  function search(term: string) {
    setQuery(term)
    setChosen(null)
    if (term.trim().length < 2) { setResults([]); return }
    startSearch(async () => {
      try { setResults(await searchInvestorsForChain(term, investorId)) }
      catch (err) { alertError(err) }
    })
  }

  function file() {
    if (!chosen) return
    startFile(async () => {
      try {
        await proposeInvestorChain({ investorId, referrerInvestorId: chosen.id, note })
        setPicking(false); setQuery(''); setResults([]); setChosen(null); setNote('')
        router.refresh()
      } catch (err) { alertError(err) }
    })
  }

  return (
    <div className={styles.introBlock}>
      <div className={styles.introHead}>Introduced by</div>

      {partnerName ? (
        <p className={styles.introValue}>
          <span className={styles.introPartnerTag}>Partner</span> {partnerName}
        </p>
      ) : referrer ? (
        <p className={styles.introValue}>
          <Link href={`/investors/${referrer.id}`} className={styles.introLink}>{referrer.name}</Link>
          <span className={styles.introMuted}> — credit rolls up their chain to the partner at its root.</span>
        </p>
      ) : (
        <p className={styles.introMuted}>Nobody is credited with this introduction.</p>
      )}

      {canPropose && !picking && (
        <button type="button" className={styles.introAction} onClick={() => setPicking(true)}>
          {partnerName || referrer ? 'Propose a different introduction' : 'An investor introduced them'}
        </button>
      )}

      {canPropose && picking && (
        <div className={styles.introPicker}>
          <input
            className={styles.introInput}
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Which investor introduced them?"
            autoFocus
          />

          {searching && <p className={styles.introMuted}>Searching…</p>}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className={styles.introMuted}>
              No investor matches that and rolls up to a partner. Only investors already in a
              partner&apos;s tree can pass credit on.
            </p>
          )}

          {results.length > 0 && !chosen && (
            <ul className={styles.introResults}>
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" className={styles.introResult} onClick={() => setChosen(r)}>
                    <span>{r.name}</span>
                    <span className={styles.introMuted}>
                      {r.root_partner_name ? `rolls up to ${r.root_partner_name}` : 'no partner at the root'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {chosen && (
            <div className={styles.introConfirm}>
              <p className={styles.introValue}>
                {chosen.name} introduced {investorName}.
              </p>
              <p className={styles.introMuted}>
                {chosen.root_partner_name
                  ? `This credits ${chosen.root_partner_name}, who is at the root of their chain. `
                    + 'It needs a coordinator and a founder signature before anything is written.'
                  : 'They do not roll up to a partner, so this would credit nobody.'}
              </p>
              <input
                className={styles.introInput}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="How do we know? (optional)"
              />
              <div className={styles.introButtons}>
                <button type="button" className={styles.introCancel} onClick={() => setChosen(null)}>Back</button>
                <button
                  type="button"
                  className={styles.introPropose}
                  onClick={file}
                  disabled={filing || !chosen.root_partner_name}
                >
                  {filing ? 'Filing…' : 'File the claim'}
                </button>
              </div>
            </div>
          )}

          {!chosen && (
            <button type="button" className={styles.introCancel} onClick={() => { setPicking(false); setQuery(''); setResults([]) }}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
