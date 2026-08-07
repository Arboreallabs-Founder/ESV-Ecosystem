'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Investor, InvestorContact, InvestmentStage, PortfolioEntry } from '@/lib/types'
import {
  INVESTMENT_STAGES, INVESTMENT_STAGE_LABELS, POC_COVERAGE_LABELS, POC_EMPLOYMENT_LABELS,
  SERVICE_TYPE_LABELS, pocCoverage,
} from '@/lib/types'
import {
  addPortfolioEntry, assignPocSearch, clearPocSearch, deletePortfolioEntry,
  setContactEmployment, setContactOutreach, setContactRank,
} from '@/app/actions/investor-profile'
import panels from '@/app/_components/panels/panels.module.css'
import profile from './investor-profile.module.css'

const fmtMoney = (n: number | null, cur: string | null) => {
  if (n == null) return null
  if (cur === 'INR') {
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n % 10_000_000 ? 1 : 0)} Cr`
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(0)} L`
    return `₹${n.toLocaleString('en-IN')}`
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('en-US')}`
}

export default function InvestorProfile({
  investor, canManage, team,
}: {
  investor: Investor
  canManage: boolean
  team: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function run(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); router.refresh() }
      catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    })
  }

  const contacts = investor.contacts ?? []
  const portfolio = investor.portfolio ?? []

  const ticket = useMemo(() => {
    const lo = fmtMoney(investor.ticket_size_min, investor.ticket_currency)
    const hi = fmtMoney(investor.ticket_size_max, investor.ticket_currency)
    if (!lo) return null
    return hi ? `${lo} – ${hi}` : lo
  }, [investor])

  const stageRange = investor.stage_min
    ? investor.stage_max && investor.stage_max !== investor.stage_min
      ? `${INVESTMENT_STAGE_LABELS[investor.stage_min]} → ${INVESTMENT_STAGE_LABELS[investor.stage_max]}`
      : INVESTMENT_STAGE_LABELS[investor.stage_min]
    : null

  // Portfolio tags rolled up — this is the insight the tagging exists for.
  const tagRollup = useMemo(() => {
    const s = new Map<string, number>()
    for (const p of portfolio) for (const t of p.sector_tags) s.set(t, (s.get(t) ?? 0) + 1)
    return [...s.entries()].sort((a, b) => b[1] - a[1])
  }, [portfolio])

  const linked = portfolio.filter((p) => p.company_id).length
  const coverage = pocCoverage(contacts)

  return (
    <div className={profile.page}>
      <div className={profile.breadcrumb}>
        <Link href="/investors" className={profile.backLink}>← Investors</Link>
      </div>

      <header className={profile.header}>
        <div>
          <h1 className={profile.title}>{investor.name}</h1>
          <div className={profile.subRow}>
            <span className={profile.typeBadge}>{SERVICE_TYPE_LABELS[investor.service_type]}</span>
            {investor.country && <span className={profile.meta}>{investor.country}</span>}
            {investor.website && (
              <a href={investor.website} target="_blank" rel="noopener noreferrer" className={profile.link}>
                {investor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            {/* Warm is worth surfacing; cold and unknown are not the same thing, so unknown says so. */}
            {investor.connect_strength === 'warm' && <span className={profile.warm}>Warm</span>}
            {investor.connect_strength === 'cold' && <span className={profile.cold}>Cold</span>}
          </div>
        </div>
      </header>

      {error && <div className={profile.error}>{error}</div>}

      {/* The gap, and the way to act on it, in the same place. */}
      {investor.service_type !== 'angel_investor' && coverage !== 'covered' && (
        <PocGapBanner
          investor={investor}
          coverage={coverage}
          canManage={canManage}
          team={team}
          pending={pending}
          run={run}
        />
      )}

      <div className={panels.overview}>
        {/* ── Preferences ── */}
        <section className={panels.panel}>
          <div className={panels.panelHead}>
            <h2 className={panels.panelTitle}>What they invest in</h2>
            {investor.import_source && (
              <span className={panels.panelNote} title={`Imported from ${investor.import_source}`}>
                from the ESV database
              </span>
            )}
          </div>

          <div className={profile.factGrid}>
            <Fact label="Ticket size" value={ticket} empty="Not recorded" />
            <Fact label="Stage" value={stageRange} empty={investor.stage_raw ?? 'Not recorded'} />
            <Fact
              label="ESV coverage"
              value={investor.esv_poc_names.length ? investor.esv_poc_names.join(', ') : null}
              empty="Nobody recorded"
            />
          </div>

          <div className={profile.tagBlock}>
            <div className={profile.tagLabel}>Sectors</div>
            <div className={profile.tags}>
              {investor.sectors.length
                ? investor.sectors.map((s) => <span key={s} className={profile.tag}>{s}</span>)
                : <span className={profile.emptyInline}>No sectors recorded</span>}
            </div>
          </div>

          {investor.excluded_sectors.length > 0 && (
            <div className={profile.tagBlock}>
              {/* The most expensive thing to miss when building a list. */}
              <div className={profile.tagLabel}>Will not look at</div>
              <div className={profile.tags}>
                {investor.excluded_sectors.map((s) => <span key={s} className={profile.tagNo}>{s}</span>)}
              </div>
            </div>
          )}

          {investor.business_types?.length > 0 && (
            <div className={profile.tagBlock}>
              <div className={profile.tagLabel}>Business types</div>
              <div className={profile.tags}>
                {investor.business_types.map((s) => <span key={s} className={profile.tag}>{s}</span>)}
              </div>
            </div>
          )}
        </section>

        <div className={panels.overviewSide}>
          {/* ── Portfolio rollup ── */}
          <section className={panels.panel}>
            <div className={panels.panelHead}>
              <h2 className={panels.panelTitle}>Portfolio at a glance</h2>
              <span className={panels.panelNote}>{portfolio.length} compan{portfolio.length === 1 ? 'y' : 'ies'}</span>
            </div>
            {portfolio.length === 0 ? (
              <div className={panels.chartEmpty}>Nothing recorded yet.</div>
            ) : (
              <>
                <div className={profile.tags}>
                  {tagRollup.length === 0
                    ? <span className={profile.emptyInline}>No tags yet — tag the companies below to make this useful.</span>
                    : tagRollup.map(([t, n]) => (
                        <span key={t} className={profile.tag}>{t} <b>{n}</b></span>
                      ))}
                </div>
                {linked > 0 && (
                  <p className={panels.panelFoot}>
                    We already track {linked} of these {linked === 1 ? 'company' : 'companies'}.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* ── People ── */}
      <section className={panels.panel} style={{ marginTop: '1rem' }}>
        <div className={panels.panelHead}>
          <h2 className={panels.panelTitle}>Who to contact</h2>
          <span className={panels.panelNote}>
            {contacts.filter((c) => c.employment_status === 'active').length} confirmed still there
          </span>
        </div>
        {contacts.length === 0 ? (
          <div className={panels.chartEmpty}>No contacts recorded for this fund.</div>
        ) : (
          <div className={profile.contactList}>
            {contacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                canManage={canManage}
                team={team}
                pending={pending}
                run={run}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Portfolio ── */}
      <PortfolioSection
        investorId={investor.id}
        entries={portfolio}
        canManage={canManage}
        pending={pending}
        run={run}
      />
    </div>
  )
}

function PocGapBanner({
  investor, coverage, canManage, team, pending, run,
}: {
  investor: Investor
  coverage: ReturnType<typeof pocCoverage>
  canManage: boolean
  team: Array<{ id: string; name: string }>
  pending: boolean
  run: (fn: () => Promise<unknown>) => void
}) {
  const [who, setWho] = useState('')
  const searching = Boolean(investor.poc_search_task_id)

  // The best lead the assignee has: who we knew and where they went.
  const moved = (investor.contacts ?? [])
    .filter((c) => c.employment_status === 'moved_on' && c.new_company)
    .map((c) => `${c.name} → ${c.new_company}`)

  return (
    <div className={searching ? profile.gapBannerOn : profile.gapBanner}>
      <div className={profile.gapText}>
        <strong>{POC_COVERAGE_LABELS[coverage]}.</strong>{' '}
        {coverage === 'none'
          ? 'We have no contact on record for this fund.'
          : coverage === 'all_left'
            ? 'Everyone we knew here has moved on.'
            : 'Nobody has checked whether these contacts are still there.'}
        {moved.length > 0 && (
          <span className={profile.gapLead}> Last known: {moved.join(', ')}.</span>
        )}
        {searching && <span className={profile.gapLead}> Someone is on it — see the task board.</span>}
      </div>
      {canManage && (
        <div className={profile.gapActions}>
          {searching ? (
            <button className={profile.miniBtn} disabled={pending}
              onClick={() => run(() => clearPocSearch(investor.id))}>
              Call it off
            </button>
          ) : (
            <>
              <select className={profile.input} value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Assign someone to find one…</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className={profile.primaryBtn} disabled={pending || !who}
                onClick={() => run(() => assignPocSearch(investor.id, who))}>
                Create task
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Fact({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return (
    <div className={profile.fact}>
      <div className={profile.factLabel}>{label}</div>
      <div className={value ? profile.factValue : profile.factEmpty}>{value ?? empty}</div>
    </div>
  )
}

function ContactRow({
  contact: c, canManage, team, pending, run,
}: {
  contact: InvestorContact
  canManage: boolean
  team: Array<{ id: string; name: string }>
  pending: boolean
  run: (fn: () => Promise<unknown>) => void
}) {
  const [open, setOpen] = useState(false)
  const [newCompany, setNewCompany] = useState(c.new_company ?? '')
  const [newRole, setNewRole] = useState(c.new_designation ?? '')
  const [method, setMethod] = useState(c.contact_method ?? '')
  const [by, setBy] = useState(c.contacted_by_user_id ?? '')

  const stale = c.employment_status === 'unknown'
  return (
    <div className={`${profile.contact} ${c.employment_status === 'moved_on' ? profile.contactGone : ''}`}>
      <div className={profile.contactHead}>
        <div className={profile.contactWho}>
          <span className={profile.contactName}>{c.name}</span>
          {c.rank !== 'other' && (
            <span className={c.rank === 'primary' ? profile.rankPrimary : profile.rankSecondary}>
              {c.rank === 'primary' ? 'Primary' : 'Secondary'}
            </span>
          )}
          {/* Status is spelled out, never colour alone. */}
          <span className={
            c.employment_status === 'active' ? profile.empActive
            : c.employment_status === 'moved_on' ? profile.empGone : profile.empUnknown}
          >
            {POC_EMPLOYMENT_LABELS[c.employment_status]}
          </span>
        </div>
        {canManage && (
          <button className={profile.miniBtn} onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Update'}
          </button>
        )}
      </div>

      <div className={profile.contactMeta}>
        {c.role && <span>{c.role}</span>}
        {c.email && <a href={`mailto:${c.email}`} className={profile.link}>{c.email}</a>}
        {c.phone && <span>{c.phone}</span>}
        {c.linkedin_url && (
          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className={profile.link}>LinkedIn</a>
        )}
      </div>

      {c.employment_status === 'moved_on' && c.new_company && (
        // Not a tombstone: someone who moved to another fund is a warm intro at the new one.
        <div className={profile.movedTo}>
          Now at <strong>{c.new_company}</strong>{c.new_designation ? ` — ${c.new_designation}` : ''}
        </div>
      )}
      {c.audit_note && <div className={profile.auditNote}>{c.audit_note}</div>}
      <div className={profile.contactFoot}>
        {c.contacted_by_name && <span>Contacted by {c.contacted_by_name}{c.contact_method ? ` · ${c.contact_method}` : ''}</span>}
        {c.last_verified_at
          ? <span>Verified {new Date(c.last_verified_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          : stale && <span className={profile.unverified}>Never verified</span>}
      </div>

      {open && canManage && (
        <div className={profile.editor}>
          <div className={profile.editorRow}>
            <span className={profile.editorLabel}>Still there?</span>
            <button className={profile.miniBtn} disabled={pending}
              onClick={() => run(() => setContactEmployment(c.id, { employment_status: 'active' }))}>Yes</button>
            <button className={profile.miniBtn} disabled={pending}
              onClick={() => run(() => setContactEmployment(c.id, {
                employment_status: 'moved_on', new_company: newCompany, new_designation: newRole,
              }))}>No — moved on</button>
            <input className={profile.input} value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Now at…" />
            <input className={profile.input} value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="New role" />
          </div>
          <div className={profile.editorRow}>
            <span className={profile.editorLabel}>Rank</span>
            <button className={profile.miniBtn} disabled={pending} onClick={() => run(() => setContactRank(c.id, 'primary'))}>Primary</button>
            <button className={profile.miniBtn} disabled={pending} onClick={() => run(() => setContactRank(c.id, 'secondary'))}>Secondary</button>
            <button className={profile.miniBtn} disabled={pending} onClick={() => run(() => setContactRank(c.id, 'other'))}>Neither</button>
          </div>
          <div className={profile.editorRow}>
            <span className={profile.editorLabel}>Outreach</span>
            <select className={profile.input} value={by} onChange={(e) => setBy(e.target.value)}>
              <option value="">Who contacted them…</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input className={profile.input} value={method} onChange={(e) => setMethod(e.target.value)} placeholder="How — email, LinkedIn, call, intro" />
            <button className={profile.miniBtn} disabled={pending}
              onClick={() => run(() => setContactOutreach(c.id, {
                contacted_by_user_id: by || null,
                contacted_by_name: team.find((t) => t.id === by)?.name ?? null,
                contact_method: method,
              }))}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PortfolioSection({
  investorId, entries, canManage, pending, run,
}: {
  investorId: string
  entries: PortfolioEntry[]
  canManage: boolean
  pending: boolean
  run: (fn: () => Promise<unknown>) => void
}) {
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [types, setTypes] = useState('')
  const [stage, setStage] = useState<InvestmentStage | ''>('')
  const [year, setYear] = useState('')

  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  return (
    <section className={panels.panel} style={{ marginTop: '1rem' }}>
      <div className={panels.panelHead}>
        <h2 className={panels.panelTitle}>Invested in</h2>
        <span className={panels.panelNote}>{entries.length} recorded</span>
      </div>

      {entries.length === 0 ? (
        <div className={panels.chartEmpty}>
          No portfolio recorded. Add the companies they have backed — the tags are what make this
          searchable later.
        </div>
      ) : (
        <div className={panels.tableScroll}>
          <table className={panels.overviewTable}>
            <thead>
              <tr><th>Company</th><th>Sectors</th><th>Business type</th><th>Stage</th><th>Year</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.company_id
                      ? <Link href={`/companies?id=${p.company_id}`} className={profile.link}>{p.company_name}</Link>
                      : p.company_name}
                    {p.company_id && <span className={profile.trackedTag}>tracked</span>}
                  </td>
                  <td>
                    <span className={profile.tags}>
                      {p.sector_tags.length
                        ? p.sector_tags.map((t) => <span key={t} className={profile.tagSm}>{t}</span>)
                        : <span className={profile.emptyInline}>—</span>}
                    </span>
                  </td>
                  <td>
                    <span className={profile.tags}>
                      {p.business_type_tags.length
                        ? p.business_type_tags.map((t) => <span key={t} className={profile.tagSm}>{t}</span>)
                        : <span className={profile.emptyInline}>—</span>}
                    </span>
                  </td>
                  <td>{p.invested_stage ? INVESTMENT_STAGE_LABELS[p.invested_stage] : '—'}</td>
                  <td>{p.invested_year ?? '—'}</td>
                  <td className={profile.num}>
                    {canManage && (
                      <button className={profile.miniBtn} disabled={pending}
                        onClick={() => run(() => deletePortfolioEntry(p.id))}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <div className={profile.addRow}>
          <input className={profile.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" />
          <input className={profile.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Sector tags, comma separated" />
          <input className={profile.input} value={types} onChange={(e) => setTypes(e.target.value)} placeholder="Business types, e.g. B2B, D2C" />
          <select className={profile.input} value={stage} onChange={(e) => setStage(e.target.value as InvestmentStage | '')}>
            <option value="">Stage…</option>
            {INVESTMENT_STAGES.map((s) => <option key={s} value={s}>{INVESTMENT_STAGE_LABELS[s]}</option>)}
          </select>
          <input className={profile.input} style={{ width: 90 }} value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" />
          <button
            className={profile.primaryBtn}
            disabled={pending || !name.trim()}
            onClick={() => run(async () => {
              await addPortfolioEntry(investorId, {
                company_name: name,
                sector_tags: split(tags),
                business_type_tags: split(types),
                invested_stage: stage || null,
                invested_year: year ? Number(year) : null,
              })
              setName(''); setTags(''); setTypes(''); setStage(''); setYear('')
            })}
          >
            Add
          </button>
        </div>
      )}
    </section>
  )
}
