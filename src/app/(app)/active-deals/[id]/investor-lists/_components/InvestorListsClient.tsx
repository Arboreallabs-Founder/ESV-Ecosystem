'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { InvestorList } from '@/lib/investor-lists'
import {
  addInvestorsToList, createInvestorList, matchExclusion, removeInvestorFromList,
  shareInvestorList, unshareInvestorList,
} from '@/app/actions/investor-lists'
import panels from '@/app/_components/panels/panels.module.css'
import styles from '../investor-lists.module.css'

type Fund = {
  id: string
  name: string
  website: string | null
  sectors: string[]
  excluded_sectors: string[]
  connect_strength: 'warm' | 'cold' | 'unknown'
}

export default function InvestorListsClient({
  dealId, dealName, lists, funds,
}: {
  dealId: string
  dealName: string
  lists: InvestorList[]
  funds: Fund[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [openId, setOpenId] = useState<string | null>(lists[0]?.id ?? null)
  const [pending, start] = useTransition()

  function run(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); router.refresh() }
      catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    })
  }

  return (
    <div className={styles.page}>
      <Link href={`/active-deals/${dealId}`} className={styles.back}>← {dealName}</Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Investor lists</h1>
          <p className={styles.sub}>
            Build a shortlist, send the founder a link, and they untick anyone they&apos;d rather
            we didn&apos;t approach. They see fund names and websites only.
          </p>
        </div>
        <div className={styles.newRow}>
          <input
            className={panels.tableSearch}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New list name, e.g. Seed round — tranche 1"
          />
          <button
            className={styles.primaryBtn}
            disabled={pending || !newName.trim()}
            onClick={() => run(async () => {
              const id = await createInvestorList(dealId, newName)
              setNewName(''); setOpenId(id)
            })}
          >
            Create
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {lists.length === 0 ? (
        <div className={panels.chartEmpty}>
          No lists yet. Create one to start shortlisting funds for {dealName}.
        </div>
      ) : (
        lists.map((list) => (
          <ListPanel
            key={list.id}
            list={list}
            dealName={dealName}
            funds={funds}
            open={openId === list.id}
            onToggle={() => setOpenId(openId === list.id ? null : list.id)}
            pending={pending}
            run={run}
          />
        ))
      )}
    </div>
  )
}

function ListPanel({
  list, dealName, funds, open, onToggle, pending, run,
}: {
  list: InvestorList
  dealName: string
  funds: Fund[]
  open: boolean
  onToggle: () => void
  pending: boolean
  run: (fn: () => Promise<unknown>) => void
}) {
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [intro, setIntro] = useState(list.intro_note ?? '')
  const [copied, setCopied] = useState<string | null>(null)

  const onList = useMemo(() => new Set(list.items.map((i) => i.investor_id)), [list.items])
  const editable = list.status === 'draft'

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return [] as Fund[]
    return funds
      .filter((f) => !onList.has(f.id) && f.name.toLowerCase().includes(q))
      .slice(0, 25)
  }, [search, funds, onList])

  const approved = list.items.filter((i) => i.approved)
  const declined = list.items.filter((i) => !i.approved)
  const shareUrl = list.share_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/il/${list.share_token}`
    : null

  // The email is generated from the list rather than typed each time, so the link and the count
  // can never disagree with what was actually shared.
  const emailBody = useMemo(() => {
    const lines = [
      `Hi,`,
      ``,
      `We've put together a shortlist of ${list.items.length} investors we'd like to approach for ${dealName}.`,
      ``,
      `Before we reach out to anyone, please take a look and untick any you'd rather we left alone —`,
      `it takes a minute and you don't need to explain why:`,
      ``,
      shareUrl ?? '[share the list to generate the link]',
      ``,
      `There's also space to name anyone else you'd like us to avoid, whether or not they're on the list.`,
      ``,
      `Thanks,`,
    ]
    return lines.join('\n')
  }, [list.items.length, dealName, shareUrl])

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600)
    } catch { /* clipboard blocked — the text is on screen either way */ }
  }

  return (
    <section className={panels.panel} style={{ marginBottom: '1rem' }}>
      <div className={styles.listHead}>
        <div>
          <h2 className={panels.panelTitle}>{list.name}</h2>
          <div className={styles.listMeta}>
            {list.items.length} fund{list.items.length === 1 ? '' : 's'}
            {list.status === 'shared' && ' · shared'}
            {list.first_viewed_at && ' · opened'}
            {list.responded_at && ` · answered ${new Date(list.responded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
          </div>
        </div>
        <div className={styles.listActions}>
          <span className={
            list.responded_at ? styles.pillAnswered
            : list.status === 'shared' ? styles.pillShared : styles.pillDraft}
          >
            {list.responded_at ? 'Answered' : list.status === 'shared' ? 'Awaiting founder' : 'Draft'}
          </span>
          <button className={panels.tableReset} onClick={onToggle}>{open ? 'Close' : 'Open'}</button>
        </div>
      </div>

      {open && (
        <div className={styles.body}>
          {/* ── The founder's answer, once it exists ── */}
          {list.responded_at && (
            <div className={styles.answer}>
              <div className={styles.answerHead}>
                The founder approved <strong>{approved.length}</strong> of {list.items.length}
                {declined.length > 0 && <> and asked us to skip <strong>{declined.length}</strong></>}
              </div>
              {list.founder_note && <div className={styles.answerNote}>“{list.founder_note}”</div>}
            </div>
          )}

          {/* ── Who's on it ── */}
          {list.items.length === 0 ? (
            <div className={panels.chartEmpty}>Nobody on this list yet.</div>
          ) : (
            <div className={panels.tableScroll}>
              <table className={panels.overviewTable}>
                <thead>
                  <tr><th>Fund</th><th>Sectors</th><th>Primary contact</th><th>Founder</th><th></th></tr>
                </thead>
                <tbody>
                  {list.items.map((item) => {
                    const inv = item.investor
                    const primary = inv?.contacts.find((c) => c.rank === 'primary')
                    return (
                      <tr key={item.id} className={!item.approved && list.responded_at ? styles.declinedRow : undefined}>
                        <td>
                          {inv
                            ? <Link href={`/investors/${inv.id}`} className={styles.link}>{inv.name}</Link>
                            : <span className={styles.muted}>Removed</span>}
                          {inv?.connect_strength === 'warm' && <span className={styles.warm}>Warm</span>}
                        </td>
                        <td className={styles.muted}>
                          {inv?.sectors.slice(0, 3).join(', ') || '—'}
                          {/* Exclusions belong in front of whoever is choosing, not buried on the profile. */}
                          {inv && inv.excluded_sectors.length > 0 && (
                            <div className={styles.noSectors}>Won&apos;t look at: {inv.excluded_sectors.join(', ')}</div>
                          )}
                        </td>
                        <td className={styles.muted}>
                          {primary
                            ? <>{primary.name}{primary.employment_status === 'moved_on' && <span className={styles.gone}>has left</span>}</>
                            : <span className={styles.warnInline}>No primary contact</span>}
                        </td>
                        <td>
                          {!list.responded_at
                            ? <span className={styles.muted}>—</span>
                            : item.approved
                              ? <span className={styles.okTag}>Approved</span>
                              : <span className={styles.noTag}>Skip</span>}
                        </td>
                        <td className={styles.num}>
                          {editable && (
                            <button className={styles.miniBtn} disabled={pending}
                              onClick={() => run(() => removeInvestorFromList(item.id))}>Remove</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Add funds ── */}
          {editable && (
            <div className={styles.addBlock}>
              <input
                className={panels.tableSearch}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search funds to add…"
              />
              {matches.length > 0 && (
                <div className={styles.results}>
                  {matches.map((f) => (
                    <label key={f.id} className={styles.result}>
                      <input
                        type="checkbox"
                        checked={picked.has(f.id)}
                        onChange={() => setPicked((p) => {
                          const n = new Set(p); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n
                        })}
                      />
                      <span className={styles.resultName}>{f.name}</span>
                      <span className={styles.resultMeta}>{f.sectors.slice(0, 3).join(', ')}</span>
                      {f.connect_strength === 'warm' && <span className={styles.warm}>Warm</span>}
                    </label>
                  ))}
                </div>
              )}
              {picked.size > 0 && (
                <button
                  className={styles.primaryBtn}
                  disabled={pending}
                  onClick={() => run(async () => {
                    await addInvestorsToList(list.id, [...picked])
                    setPicked(new Set()); setSearch('')
                  })}
                >
                  Add {picked.size} to the list
                </button>
              )}
            </div>
          )}

          {/* ── The founder's own exclusions ── */}
          {list.exclusions.length > 0 && (
            <div className={styles.exclusions}>
              <h3 className={styles.blockTitle}>Names the founder asked us to avoid</h3>
              {list.exclusions.map((x) => (
                <div key={x.id} className={styles.exclRow}>
                  <span className={styles.exclName}>{x.raw_name}</span>
                  {x.reason && <span className={styles.muted}>{x.reason}</span>}
                  {x.investor
                    ? <span className={styles.okTag}>matched to {x.investor.name}</span>
                    : (
                      // Unmatched means we cannot check outreach against it, so it is flagged
                      // rather than left looking handled.
                      <MatchPicker
                        exclusionId={x.id}
                        funds={funds}
                        pending={pending}
                        run={run}
                      />
                    )}
                </div>
              ))}
            </div>
          )}

          {/* ── Share ── */}
          <div className={styles.shareBlock}>
            <h3 className={styles.blockTitle}>Send it to the founder</h3>
            {list.status === 'draft' ? (
              <>
                <textarea
                  className={styles.textarea}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  rows={3}
                  placeholder="A line or two the founder sees above the list (optional)"
                />
                <button
                  className={styles.primaryBtn}
                  disabled={pending || list.items.length === 0}
                  onClick={() => run(() => shareInvestorList(list.id, intro))}
                >
                  Share and get the link
                </button>
                {list.items.length === 0 && (
                  <span className={styles.hint}>Add at least one fund first.</span>
                )}
              </>
            ) : (
              <>
                <div className={styles.linkRow}>
                  <code className={styles.linkBox}>{shareUrl}</code>
                  <button className={panels.tableReset} onClick={() => copy(shareUrl!, 'link')}>
                    {copied === 'link' ? 'Copied' : 'Copy link'}
                  </button>
                  <button className={panels.tableReset} disabled={pending}
                    onClick={() => run(() => unshareInvestorList(list.id))}>Withdraw</button>
                </div>

                {/* Email template, generated from the list so the link and the count cannot drift. */}
                <div className={styles.emailBlock}>
                  <div className={styles.emailHead}>
                    <span className={styles.blockTitle}>Email template</span>
                    <button className={panels.tableReset} onClick={() => copy(emailBody, 'email')}>
                      {copied === 'email' ? 'Copied' : 'Copy email'}
                    </button>
                  </div>
                  <pre className={styles.email}>{emailBody}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function MatchPicker({
  exclusionId, funds, pending, run,
}: {
  exclusionId: string
  funds: Fund[]
  pending: boolean
  run: (fn: () => Promise<unknown>) => void
}) {
  const [value, setValue] = useState('')
  return (
    <span className={styles.matchRow}>
      <span className={styles.warnInline}>Not matched</span>
      <select
        className={styles.select}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (e.target.value) run(() => matchExclusion(exclusionId, e.target.value))
        }}
        disabled={pending}
      >
        <option value="">Link to a fund…</option>
        {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </span>
  )
}
