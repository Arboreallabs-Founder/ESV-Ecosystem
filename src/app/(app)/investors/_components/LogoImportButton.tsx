'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { countFundsMissingLogos, fetchFundLogos } from '@/app/actions/investor-logos'
import { describeError } from '@/lib/client-errors'
import styles from '../investors.module.css'

/**
 * Fetch logos for every fund that has a domain and no logo.
 *
 * Loops batches from the client rather than asking the server for one long run: 248 network round
 * trips do not fit in a Server Action's budget, and a request that dies at the timeout leaves
 * nobody knowing how far it got. Each batch commits its own work, so stopping halfway keeps
 * everything already fetched.
 */
export default function LogoImportButton() {
  const router = useRouter()
  const [missing, setMissing] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [stop, setStop] = useState(false)
  const [done, setDone] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [failed, setFailed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { countFundsMissingLogos().then(setMissing).catch(() => setMissing(null)) }, [])

  async function run() {
    setRunning(true); setStop(false); setError(null)
    setDone(0); setSkipped(0); setFailed(0)
    let guard = 0
    try {
      // Bounded: a bug that never reduced `remaining` would otherwise loop until the tab is closed.
      while (guard++ < 60) {
        const r = await fetchFundLogos(12)
        setDone((n) => n + r.updated)
        setSkipped((n) => n + r.tooSmall)
        setFailed((n) => n + r.failed)
        setMissing(r.remaining)
        if (r.remaining === 0) break
        if (stop) break
      }
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setRunning(false)
      router.refresh()
    }
  }

  if (missing === 0 && !running && done === 0) return null

  return (
    <span className={styles.logoImportWrap}>
      <button
        className={styles.ghostBtn}
        onClick={() => (running ? setStop(true) : run())}
        disabled={missing === null}
      >
        {running
          ? `Fetching… ${done} done`
          : missing && missing > 0
            ? `Get ${missing} fund logos`
            : 'Get fund logos'}
      </button>

      {/* Said plainly, because a count that only goes up hides the two outcomes that are not
          successes -- a fund whose only icon is 16px, and a domain that did not answer. */}
      {(done > 0 || skipped > 0 || failed > 0) && !running && (
        <span className={styles.logoImportNote}>
          {done} added
          {skipped > 0 && `, ${skipped} skipped (icon too small to look right)`}
          {failed > 0 && `, ${failed} unreachable`}
        </span>
      )}
      {error && <span className={styles.logoImportErr}>{error}</span>}
    </span>
  )
}
