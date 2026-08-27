'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { alertError } from '@/lib/client-errors'
import styles from '../investors.module.css'

type Group = { match_key: string; ids: string[]; names: string[] }
type Detail = {
  id: string; name: string; website: string | null; country: string | null
  sectors: string[]; stage: string | null
  ticket_size_min: number | null; ticket_size_max: number | null
  created_at: string
}

/**
 * Finding and merging duplicate investor records.
 *
 * Two rows for one fund is not a cosmetic problem: each one qualifies on its own tags, so the fund
 * turns up twice on a suggestion list — sometimes once as a thematic match and once as sector
 * agnostic, which reads as a bug in the banding when it is really two records telling the truth
 * separately.
 *
 * Matching strips the fund suffixes, so "Blume" and "Blume Ventures" group together. Those are the
 * pairs worth surfacing; identical names are the ones somebody would have spotted anyway.
 */
export default function DuplicatesModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [details, setDetails] = useState<Record<string, Detail>>({})
  const [keep, setKeep] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data, error: err } = await supabase.rpc('find_investor_duplicates')
      if (err) { setError(err.message); setGroups([]); return }
      const gs = (data ?? []) as Group[]
      setGroups(gs)
      const ids = gs.flatMap((g) => g.ids)
      if (ids.length === 0) return
      const { data: rows } = await supabase
        .from('investors')
        .select('id, name, website, country, sectors, stage, ticket_size_min, ticket_size_max, created_at')
        .in('id', ids)
      const map: Record<string, Detail> = {}
      for (const r of (rows ?? []) as Detail[]) map[r.id] = r
      setDetails(map)
      // The older record is the safer default keeper: it has had longer to accumulate the deals,
      // lists and notes that point at it. The admin can override per group.
      const pick: Record<string, string> = {}
      for (const g of gs) {
        pick[g.match_key] = [...g.ids].sort((a, b) =>
          (map[a]?.created_at ?? '').localeCompare(map[b]?.created_at ?? ''))[0]
      }
      setKeep(pick)
    })()
  }, [])

  function merge(g: Group) {
    const keeper = keep[g.match_key]
    if (!keeper) return
    const losers = g.ids.filter((id) => id !== keeper)
    const keepName = details[keeper]?.name ?? 'this record'
    const loseNames = losers.map((id) => details[id]?.name ?? id).join(', ')
    if (!confirm(
      `Merge ${loseNames} into ${keepName}?\n\n`
      + 'Everything pointing at the other record — deals, lists, contacts, outreach — moves across, '
      + 'and anything the kept record is missing is filled in from it.\n\n'
      + 'This cannot be undone.',
    )) return

    start(async () => {
      const supabase = createClient()
      for (const loser of losers) {
        const { error: err } = await supabase.rpc('merge_investors', { p_keep: keeper, p_merge: loser })
        if (err) { alertError(new Error(err.message)); return }
      }
      setGroups((prev) => (prev ?? []).filter((x) => x.match_key !== g.match_key))
      router.refresh()
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.importModal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.importModalHead}>
          <span className={styles.modalTitle}>Possible duplicates</span>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>

        <p className={styles.dupIntro}>
          Records whose names match once fund suffixes are stripped, so &ldquo;Blume&rdquo; and
          &ldquo;Blume Ventures&rdquo; group together. Choose which record to keep — the other is
          merged into it and everything pointing at it moves across.
        </p>

        {error && <div className={styles.errBox}>{error}</div>}

        {groups === null ? (
          <div className={styles.dupEmpty}>Looking…</div>
        ) : groups.length === 0 ? (
          <div className={styles.dupEmpty}>No duplicate names found.</div>
        ) : (
          groups.map((g) => (
            <div key={g.match_key} className={styles.dupGroup}>
              {g.ids.map((id) => {
                const d = details[id]
                const isKeeper = keep[g.match_key] === id
                return (
                  <label key={id} className={isKeeper ? styles.dupRowKeep : styles.dupRow}>
                    <input
                      type="radio"
                      name={`keep-${g.match_key}`}
                      checked={isKeeper}
                      onChange={() => setKeep((p) => ({ ...p, [g.match_key]: id }))}
                    />
                    <span className={styles.dupName}>{d?.name ?? '…'}</span>
                    {/* What actually distinguishes them. Without this the choice is a coin toss
                        between two identical-looking names. */}
                    <span className={styles.dupMeta}>
                      {[
                        d?.country,
                        d?.stage,
                        d?.sectors?.length ? `${d.sectors.length} sector${d.sectors.length === 1 ? '' : 's'}` : null,
                        d?.website ? 'has website' : null,
                        d?.created_at ? `added ${new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                    {isKeeper && <span className={styles.dupKeepTag}>Keep this one</span>}
                  </label>
                )
              })}
              <button className={styles.dupMergeBtn} disabled={pending} onClick={() => merge(g)}>
                {pending ? 'Merging…' : 'Merge'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
