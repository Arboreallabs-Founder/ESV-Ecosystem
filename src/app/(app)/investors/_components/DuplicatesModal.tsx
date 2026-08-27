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

const DETAIL_COLS = 'id, name, website, country, sectors, stage, ticket_size_min, ticket_size_max, created_at'

/** What separates two records that read as the same name. Without it the choice is a coin toss. */
function describe(d: Detail | undefined): string {
  if (!d) return ''
  return [
    d.country,
    d.stage,
    d.sectors?.length ? `${d.sectors.length} sector${d.sectors.length === 1 ? '' : 's'}` : null,
    d.website ? 'has website' : null,
    d.created_at
      ? `added ${new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : null,
  ].filter(Boolean).join(' · ')
}

/**
 * Finding and merging duplicate investor records.
 *
 * Two rows for one fund is not cosmetic: each qualifies on its own tags, so the fund turns up twice
 * in investor-list suggestions — sometimes once as a thematic match and once as sector agnostic,
 * which reads as a bug in the banding when it is really two records telling the truth separately.
 *
 * Two ways in, because one is not enough. The automatic grouping normalises names and groups the
 * exact matches, which catches "Blume" against "Blume Ventures". It cannot catch "SANGITA MAHADIK"
 * against "Sangeeta Mahadik" — those normalise to different keys, and no amount of suffix-stripping
 * closes a spelling difference. A person searching "sang" sees both instantly. So the search is not
 * a convenience on top of the detector; it is the half of the problem the detector cannot reach.
 */
export default function DuplicatesModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [details, setDetails] = useState<Record<string, Detail>>({})
  const [keep, setKeep] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // ── Manual search ────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Detail[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [manualKeeper, setManualKeeper] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  function addDetails(rows: Detail[]) {
    setDetails((prev) => {
      const next = { ...prev }
      for (const r of rows) next[r.id] = r
      return next
    })
  }

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data, error: err } = await supabase.rpc('find_investor_duplicates')
      if (err) { setError(err.message); setGroups([]); return }
      const gs = (data ?? []) as Group[]
      setGroups(gs)
      const ids = gs.flatMap((g) => g.ids)
      if (ids.length === 0) return
      const { data: rows } = await supabase.from('investors').select(DETAIL_COLS).in('id', ids)
      const list = (rows ?? []) as Detail[]
      addDetails(list)
      const map: Record<string, Detail> = {}
      for (const r of list) map[r.id] = r
      // The older record is the safer default keeper: it has had longer to accumulate the deals,
      // lists and notes that point at it. Overridable per group.
      const pick: Record<string, string> = {}
      for (const g of gs) {
        pick[g.match_key] = [...g.ids].sort((a, b) =>
          (map[a]?.created_at ?? '').localeCompare(map[b]?.created_at ?? ''))[0]
      }
      setKeep(pick)
    })()
  }, [])

  // Debounced so typing a name is not one query per keystroke against 432 rows.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('investors').select(DETAIL_COLS)
        .ilike('name', `%${term}%`).order('name').limit(25)
      const rows = (data ?? []) as Detail[]
      setResults(rows)
      addDetails(rows)
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  /** One merge path for both halves of the screen — the RPC does not care how the pair was found. */
  function runMerge(keeper: string, losers: string[], onDone: () => void) {
    if (!keeper || losers.length === 0) return
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
      onDone()
      router.refresh()
    })
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      // Keep the keeper valid: default to the first still-picked record rather than leaving a
      // radio pointing at something no longer in the set.
      setManualKeeper((k) => (k && next.includes(k) ? k : next[0] ?? null))
      return next
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.importModal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.importModalHead}>
          <span className={styles.modalTitle}>Merge duplicate records</span>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>

        {/* ── Search: the half the detector cannot reach ── */}
        <section className={styles.dupSection}>
          <h3 className={styles.dupSectionTitle}>Search for a pair</h3>
          <p className={styles.dupIntro}>
            For duplicates the automatic check cannot see — a different spelling of the same person,
            like &ldquo;SANGITA MAHADIK&rdquo; and &ldquo;Sangeeta Mahadik&rdquo;. Search, tick the
            records that are the same, and choose which to keep.
          </p>
          <input
            className={styles.dupSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search investors by name…"
            autoFocus
          />

          {query.trim().length >= 2 && (
            <div className={styles.dupResults}>
              {searching && results.length === 0 ? (
                <div className={styles.dupEmpty}>Searching…</div>
              ) : results.length === 0 ? (
                <div className={styles.dupEmpty}>Nothing matches &ldquo;{query.trim()}&rdquo;.</div>
              ) : (
                results.map((d) => (
                  <label key={d.id} className={picked.includes(d.id) ? styles.dupRowKeep : styles.dupRow}>
                    <input type="checkbox" checked={picked.includes(d.id)} onChange={() => toggle(d.id)} />
                    <span className={styles.dupName}>{d.name}</span>
                    <span className={styles.dupMeta}>{describe(d)}</span>
                  </label>
                ))
              )}
            </div>
          )}

          {picked.length >= 2 && (
            <div className={styles.dupGroup}>
              <div className={styles.dupChooseLabel}>Which one should survive?</div>
              {picked.map((id) => (
                <label key={id} className={manualKeeper === id ? styles.dupRowKeep : styles.dupRow}>
                  <input
                    type="radio"
                    name="manual-keeper"
                    checked={manualKeeper === id}
                    onChange={() => setManualKeeper(id)}
                  />
                  <span className={styles.dupName}>{details[id]?.name ?? id}</span>
                  <span className={styles.dupMeta}>{describe(details[id])}</span>
                  {manualKeeper === id && <span className={styles.dupKeepTag}>Keep this one</span>}
                </label>
              ))}
              <button
                className={styles.dupMergeBtn}
                disabled={pending || !manualKeeper}
                onClick={() => manualKeeper && runMerge(
                  manualKeeper,
                  picked.filter((id) => id !== manualKeeper),
                  () => {
                    setPicked([]); setManualKeeper(null)
                    setResults((prev) => prev.filter((r) => r.id === manualKeeper))
                  },
                )}
              >
                {pending ? 'Merging…' : `Merge ${picked.length} records`}
              </button>
            </div>
          )}
          {picked.length === 1 && (
            <p className={styles.dupHint}>Tick one more record to merge it with this one.</p>
          )}
        </section>

        {/* ── The automatic pass ── */}
        <section className={styles.dupSection}>
          <h3 className={styles.dupSectionTitle}>
            Names that already look the same{groups && groups.length > 0 ? ` (${groups.length})` : ''}
          </h3>
          <p className={styles.dupIntro}>
            Records whose names match once fund suffixes are stripped, so &ldquo;Blume&rdquo; and
            &ldquo;Blume Ventures&rdquo; group together. It is deliberately loose, so check each
            pair is really one fund before merging.
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
                  const isKeeper = keep[g.match_key] === id
                  return (
                    <label key={id} className={isKeeper ? styles.dupRowKeep : styles.dupRow}>
                      <input
                        type="radio"
                        name={`keep-${g.match_key}`}
                        checked={isKeeper}
                        onChange={() => setKeep((p) => ({ ...p, [g.match_key]: id }))}
                      />
                      <span className={styles.dupName}>{details[id]?.name ?? '…'}</span>
                      <span className={styles.dupMeta}>{describe(details[id])}</span>
                      {isKeeper && <span className={styles.dupKeepTag}>Keep this one</span>}
                    </label>
                  )
                })}
                <button
                  className={styles.dupMergeBtn}
                  disabled={pending}
                  onClick={() => runMerge(
                    keep[g.match_key],
                    g.ids.filter((id) => id !== keep[g.match_key]),
                    () => setGroups((prev) => (prev ?? []).filter((x) => x.match_key !== g.match_key)),
                  )}
                >
                  {pending ? 'Merging…' : 'Merge'}
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
