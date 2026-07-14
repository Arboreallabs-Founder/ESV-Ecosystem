'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateCompany, deleteCompany,
  saveFundingRound, deleteFundingRound,
  saveCapTableEntry, deleteCapTableEntry,
  addDocument, removeDocument,
  addUpdate, deleteUpdate,
  saveFieldDef, setFieldValue,
  createDeskDealFromCompany, suggestMetaTags,
  type CompanyPatch,
} from '@/app/actions/companies'
import {
  COMPANY_STATUS_LABELS, COMPANY_DOC_TYPES, COMPANY_DOC_TYPE_LABELS, COMPANY_FIELD_TYPES,
  SERVICE_TYPE_LABELS,
} from '@/lib/types'
import type {
  Company, CompanyFieldDef, CompanyStatus, CompanyDocType, CompanyFieldType, CompanyFounder, CompanyTeamMember,
  SuggestedInvestor, DealCategory,
} from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import CreateDealModal from './CreateDealModal'
import CallUpdateModal from './CallUpdateModal'
import { SpecField, OVERVIEW_SPECS, TRACTION_SPECS, RAISE_SPECS, PRODUCT_SPECS, initValue, coerce, type Spec } from './field-specs'
import { formatInr, formatDate, initials, locationLabel } from './format'
import styles from '../companies.module.css'

type Team = Array<{ id: string; name: string }>

// ── Generic scalar-fields edit modal ──────────────────────────────────────────
function EditFieldsModal({
  title, company, specs, team, onClose, onSaved,
}: {
  title: string; company: Company; specs: Spec[]; team: Team; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {}
    for (const s of specs) f[s.key as string] = initValue(company, s)
    return f
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    const patch: Record<string, unknown> = {}
    for (const s of specs) patch[s.key as string] = coerce(form[s.key as string] ?? '', s.type)
    if ('name' in patch && !(patch.name as string)) { setError('Company name is required.'); return }
    startTransition(async () => {
      try { await updateCompany(company.id, patch as CompanyPatch); onSaved(); onClose() }
      catch (e) { setError((e as Error).message) }
    })
  }
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}><h2 className={styles.modalTitle}>{title}</h2><button className={styles.closeBtn} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          {specs.map((s) => (
            <SpecField key={s.key as string} spec={s} value={form[s.key as string] ?? ''} onChange={(v) => set(s.key as string, v)} team={team} />
          ))}
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={save} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// A labelled read-only stat/field.
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className={styles.stat}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div></div>
}
function SectionHead({ title, onEdit, action }: { title: string; onEdit?: () => void; action?: React.ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {action}
      {onEdit && <button className={styles.editBtn} onClick={onEdit}>Edit</button>}
    </div>
  )
}

export default function CompanyProfileClient({
  company, fieldDefs, canManage, canAuthorCard, teamMembers, suggestions, dealCategories,
}: {
  company: Company; fieldDefs: CompanyFieldDef[]; canManage: boolean; canAuthorCard: boolean; teamMembers: Team; suggestions: SuggestedInvestor[]
  dealCategories: DealCategory[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [cardPending, startCard] = useTransition()
  const [modal, setModal] = useState<null | 'overview' | 'traction' | 'raise' | 'product' | 'founders' | 'team'>(null)
  const [showDealModal, setShowDealModal] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const refresh = () => startTransition(() => router.refresh())

  function handleDelete() {
    if (!confirm(`Delete ${company.name}? This removes the profile and all its data.`)) return
    startTransition(async () => { await deleteCompany(company.id); router.push('/companies') })
  }

  function handleCreateCard() {
    startCard(async () => {
      try { await createDeskDealFromCompany(company.id); router.push('/deal-desk') }
      catch (e) { alert((e as Error).message) }
    })
  }

  const modalSpecs: Record<string, { title: string; specs: Spec[] }> = {
    overview: { title: 'Overview', specs: OVERVIEW_SPECS },
    traction: { title: 'Traction & metrics', specs: TRACTION_SPECS },
    raise: { title: 'Current raise', specs: RAISE_SPECS },
    product: { title: 'Product', specs: PRODUCT_SPECS },
  }

  return (
    <div className={styles.profile}>
      <Link href="/companies" className={styles.backLink}>← Companies</Link>

      {/* Header */}
      <div className={styles.profileHead}>
        <div className={`${styles.logoLg} ${company.logo_url ? styles.logoImg : ''}`}>{company.logo_url ? <img src={company.logo_url} alt="" /> : initials(company.name)}</div>
        <div className={styles.headMain}>
          <div className={styles.headTitleRow}>
            <h1 className={styles.companyName}>{company.name}</h1>
            <span className={`${styles.statusPill} ${styles[`status_${company.status}`]}`}>{COMPANY_STATUS_LABELS[company.status]}</span>
          </div>
          {company.legal_name && <div className={styles.legalName}>{company.legal_name}</div>}
          {company.one_liner && <p className={styles.oneLiner}>{company.one_liner}</p>}
          <div className={styles.headMeta}>
            {company.website && <a href={company.website} target="_blank" rel="noreferrer" className={styles.metaLink}>Website ↗</a>}
            <span>{locationLabel(company.hq_city, company.hq_country)}</span>
            {company.stage && <span className={styles.metaChip}>{company.stage}</span>}
            {company.sectors.map((s) => <span key={s} className={styles.metaChip}>{s}</span>)}
            {company.esv_poc?.name && <span>POC: {company.esv_poc.name}</span>}
          </div>
        </div>
        <div className={styles.headActions}>
          <button className={styles.primaryBtn} onClick={() => setShowCallModal(true)}>Update from call</button>
          {canAuthorCard && <button className={styles.ghostBtn} onClick={handleCreateCard} disabled={cardPending}>{cardPending ? 'Creating…' : 'Create card'}</button>}
          {canManage && <button className={styles.ghostBtn} onClick={() => setShowDealModal(true)}>Create deal</button>}
          <button className={styles.ghostBtn} onClick={() => setModal('overview')}>Edit</button>
          {canManage && <button className={styles.dangerBtn} onClick={handleDelete}>Delete</button>}
        </div>
      </div>

      <div className={styles.profileBody}>
        <div className={styles.profileMain}>

      {/* Key metrics */}
      <div className={styles.section}>
        <SectionHead title="Traction & metrics" onEdit={() => setModal('traction')} />
        <div className={styles.statGrid}>
          <Stat label="ARR" value={formatInr(company.arr_inr)} />
          <Stat label="MRR" value={formatInr(company.mrr_inr)} />
          <Stat label="Customers" value={company.customers_count ?? '—'} />
          <Stat label="Team size" value={company.team_size ?? '—'} />
          <Stat label="Gross margin" value={company.gross_margin_pct != null ? `${company.gross_margin_pct}%` : '—'} />
          <Stat label="Monthly burn" value={formatInr(company.monthly_burn_inr)} />
          <Stat label="Runway" value={company.runway_months != null ? `${company.runway_months} mo` : '—'} />
        </div>
      </div>

      {/* Current raise */}
      <div className={styles.section}>
        <SectionHead title="Current raise" onEdit={() => setModal('raise')} />
        <div className={styles.statGrid}>
          <Stat label="Ask" value={formatInr(company.ask_inr)} />
          <Stat label="Instrument" value={company.instrument ?? '—'} />
          <Stat label="Round status" value={company.round_status ?? '—'} />
          <Stat label="Pre-money" value={formatInr(company.pre_money_inr)} />
          <Stat label="Post-money" value={formatInr(company.post_money_inr)} />
          <Stat label="Min ticket" value={formatInr(company.min_ticket_inr)} />
          <Stat label="Raised to date" value={formatInr(company.total_raised_inr)} />
        </div>
        {company.use_of_funds && <div className={styles.para}><span className={styles.statLabel}>Use of funds</span>{company.use_of_funds}</div>}
      </div>

      {/* Product */}
      {(company.product_description || company.usp || company.tech_stack || company.product_links.length > 0 || company.description || canManage) && (
        <div className={styles.section}>
          <SectionHead title="Product" onEdit={() => setModal('product')} />
          {company.description && <div className={styles.para}><span className={styles.statLabel}>About</span>{company.description}</div>}
          {company.product_description && <div className={styles.para}><span className={styles.statLabel}>Product</span>{company.product_description}</div>}
          {company.usp && <div className={styles.para}><span className={styles.statLabel}>USP</span>{company.usp}</div>}
          {company.tech_stack && <div className={styles.para}><span className={styles.statLabel}>Tech stack</span>{company.tech_stack}</div>}
          {company.product_links.length > 0 && (
            <div className={styles.chips}>{company.product_links.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className={styles.chipLink}>{l}</a>)}</div>
          )}
        </div>
      )}

      {/* Founders */}
      <div className={styles.section}>
        <SectionHead title="Founders" onEdit={() => setModal('founders')} />
        {company.founders.length === 0 ? <div className={styles.muted}>No founders added.</div> : (
          <div className={styles.people}>
            {company.founders.map((f, i) => (
              <div key={i} className={styles.person}>
                <div className={`${styles.avatar} ${f.photo_url ? styles.avatarImg : ''}`}>
                  {f.photo_url ? <img src={f.photo_url} alt="" /> : initials(f.name)}
                </div>
                <div>
                  <div className={styles.personName}>{f.name}{f.linkedin_url && <a href={f.linkedin_url} target="_blank" rel="noreferrer" className={styles.liLink}>LinkedIn ↗</a>}</div>
                  {f.role && <div className={styles.personRole}>{f.role}</div>}
                  {f.ex_affiliations && <div className={styles.personRole}>{f.ex_affiliations}</div>}
                  {f.bio && <div className={styles.personBio}>{f.bio}</div>}
                  {f.equity_pct != null && <div className={styles.personRole}>{f.equity_pct}% equity</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team */}
      {(company.team.length > 0 || canManage) && (
        <div className={styles.section}>
          <SectionHead title="Team" onEdit={() => setModal('team')} />
          {company.team.length === 0 ? <div className={styles.muted}>No team members added.</div> : (
            <div className={styles.people}>
              {company.team.map((m, i) => (
                <div key={i} className={styles.person}>
                  <div className={styles.avatar}>{initials(m.name)}</div>
                  <div>
                    <div className={styles.personName}>{m.name}{m.linkedin_url && <a href={m.linkedin_url} target="_blank" rel="noreferrer" className={styles.liLink}>LinkedIn ↗</a>}</div>
                    {m.role && <div className={styles.personRole}>{m.role}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Funding rounds */}
      <FundingRoundsSection company={company} onChanged={refresh} />

      {/* Cap table */}
      <CapTableSection company={company} onChanged={refresh} />

      {/* Documents */}
      <DocumentsSection company={company} onChanged={refresh} />

      {/* Custom fields */}
      <CustomFieldsSection company={company} fieldDefs={fieldDefs} canManage={canManage} onChanged={refresh} />

      {/* Linked deals */}
      {(company.linked_desk_deals.length > 0 || company.linked_pipeline_entries.length > 0) && (
        <div className={styles.section}>
          <SectionHead title="Linked deals" />
          <div className={styles.linkedList}>
            {company.linked_desk_deals.map((d) => (
              <Link key={d.id} href="/deal-desk" className={styles.linkedRow}><span className={styles.linkedType}>Deal Desk</span><span>{d.company_name}</span><span className={styles.muted}>{d.deal_status}</span></Link>
            ))}
            {company.linked_pipeline_entries.map((e) => (
              <Link key={e.id} href={`/pipelines/${e.pipeline_id}`} className={styles.linkedRow}><span className={styles.linkedType}>Pipeline</span><span>{e.title ?? 'Deal'}</span><span className={styles.muted}>{e.stage_name ?? '—'}</span></Link>
            ))}
          </div>
        </div>
      )}

      {/* Updates timeline */}
      <UpdatesSection company={company} onChanged={refresh} />

        </div>

        <aside className={styles.profileAside}>
          <MetaTagsCard company={company} onChanged={refresh} />
          <SuggestedInvestorsPanel suggestions={suggestions} />
        </aside>
      </div>

      {/* Modals */}
      {modal && modalSpecs[modal] && (
        <EditFieldsModal title={modalSpecs[modal].title} company={company} specs={modalSpecs[modal].specs} team={teamMembers} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal === 'founders' && <PeopleModal title="Founders" kind="founders" company={company} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === 'team' && <PeopleModal title="Team" kind="team" company={company} onClose={() => setModal(null)} onSaved={refresh} />}
      {showDealModal && (
        <CreateDealModal companyId={company.id} companyName={company.name} categories={dealCategories} onClose={() => setShowDealModal(false)} />
      )}
      {showCallModal && (
        <CallUpdateModal company={company} fieldDefs={fieldDefs} teamMembers={teamMembers} onClose={() => setShowCallModal(false)} onSaved={refresh} />
      )}
    </div>
  )
}

// ── Founders / team repeating editor ──────────────────────────────────────────
function PeopleModal({ title, kind, company, onClose, onSaved }: {
  title: string; kind: 'founders' | 'team'; company: Company; onClose: () => void; onSaved: () => void
}) {
  const [rows, setRows] = useState<Array<Record<string, string>>>(() =>
    (kind === 'founders' ? company.founders : company.team).map((p) => ({
      name: p.name ?? '', role: p.role ?? '', linkedin_url: p.linkedin_url ?? '',
      bio: (p as CompanyFounder).bio ?? '', ex_affiliations: (p as CompanyFounder).ex_affiliations ?? '',
      photo_url: (p as CompanyFounder).photo_url ?? '',
      equity_pct: (p as CompanyFounder).equity_pct != null ? String((p as CompanyFounder).equity_pct) : '',
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const add = () => setRows((r) => [...r, { name: '', role: '', linkedin_url: '', bio: '', ex_affiliations: '', photo_url: '', equity_pct: '' }])
  const set = (i: number, k: string, v: string) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))

  function save() {
    setError(null)
    const cleaned = rows.filter((r) => r.name.trim())
    startTransition(async () => {
      try {
        if (kind === 'founders') {
          const founders: CompanyFounder[] = cleaned.map((r) => ({
            name: r.name.trim(), role: r.role.trim() || null, bio: r.bio.trim() || null,
            ex_affiliations: r.ex_affiliations.trim() || null, linkedin_url: r.linkedin_url.trim() || null,
            photo_url: r.photo_url.trim() || null,
            equity_pct: r.equity_pct.trim() ? Number(r.equity_pct) : null,
          }))
          await updateCompany(company.id, { founders })
        } else {
          const team: CompanyTeamMember[] = cleaned.map((r) => ({ name: r.name.trim(), role: r.role.trim() || null, linkedin_url: r.linkedin_url.trim() || null }))
          await updateCompany(company.id, { team })
        }
        onSaved(); onClose()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}><h2 className={styles.modalTitle}>{title}</h2><button className={styles.closeBtn} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          {rows.map((r, i) => (
            <div key={i} className={styles.repeatRow}>
              <div className={styles.repeatGrid}>
                <input className={styles.input} placeholder="Name" value={r.name} onChange={(e) => set(i, 'name', e.target.value)} />
                <input className={styles.input} placeholder="Role" value={r.role} onChange={(e) => set(i, 'role', e.target.value)} />
                <input className={styles.input} placeholder="LinkedIn URL" value={r.linkedin_url} onChange={(e) => set(i, 'linkedin_url', e.target.value)} />
                {kind === 'founders' && <>
                  <input className={styles.input} placeholder="Ex-affiliations" value={r.ex_affiliations} onChange={(e) => set(i, 'ex_affiliations', e.target.value)} />
                  <input className={styles.input} placeholder="Photo URL" value={r.photo_url} onChange={(e) => set(i, 'photo_url', e.target.value)} />
                  <input className={styles.input} placeholder="Equity %" inputMode="numeric" value={r.equity_pct} onChange={(e) => set(i, 'equity_pct', e.target.value)} />
                  <input className={styles.input} placeholder="Bio" value={r.bio} onChange={(e) => set(i, 'bio', e.target.value)} />
                </>}
              </div>
              <button className={styles.rowRemove} onClick={() => remove(i)} title="Remove">×</button>
            </div>
          ))}
          <button className={styles.ghostBtn} onClick={add}>+ Add {kind === 'founders' ? 'founder' : 'member'}</button>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Funding rounds ────────────────────────────────────────────────────────────
function FundingRoundsSection({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ round_name: '', date: '', amount_inr: '', valuation_inr: '', instrument: '', lead_investor: '', investors: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  function submit() {
    startTransition(async () => {
      await saveFundingRound(company.id, {
        round_name: form.round_name.trim() || null, date: form.date || null,
        amount_inr: form.amount_inr ? Number(form.amount_inr) : null, valuation_inr: form.valuation_inr ? Number(form.valuation_inr) : null,
        instrument: form.instrument.trim() || null, lead_investor: form.lead_investor.trim() || null,
        investors: form.investors ? form.investors.split(',').map((s) => s.trim()).filter(Boolean) : [],
        sort_order: company.funding_rounds.length,
      })
      setForm({ round_name: '', date: '', amount_inr: '', valuation_inr: '', instrument: '', lead_investor: '', investors: '' })
      setAdding(false); onChanged()
    })
  }
  return (
    <div className={styles.section}>
      <SectionHead title="Funding history" action={<button className={styles.smallBtn} onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add round'}</button>} />
      {adding && (
        <div className={styles.inlineForm}>
          <input className={styles.input} placeholder="Round (e.g. Seed)" value={form.round_name} onChange={(e) => set('round_name', e.target.value)} />
          <input className={styles.input} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          <input className={styles.input} placeholder="Amount ₹" inputMode="numeric" value={form.amount_inr} onChange={(e) => set('amount_inr', e.target.value)} />
          <input className={styles.input} placeholder="Valuation ₹" inputMode="numeric" value={form.valuation_inr} onChange={(e) => set('valuation_inr', e.target.value)} />
          <input className={styles.input} placeholder="Instrument" value={form.instrument} onChange={(e) => set('instrument', e.target.value)} />
          <input className={styles.input} placeholder="Lead investor" value={form.lead_investor} onChange={(e) => set('lead_investor', e.target.value)} />
          <input className={styles.input} placeholder="Investors (comma-sep)" value={form.investors} onChange={(e) => set('investors', e.target.value)} />
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>{pending ? 'Adding…' : 'Add'}</button>
        </div>
      )}
      {company.funding_rounds.length === 0 && !adding ? <div className={styles.muted}>No rounds recorded.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Round</th><th>Date</th><th>Amount</th><th>Valuation</th><th>Lead</th><th></th></tr></thead>
            <tbody>
              {company.funding_rounds.map((r) => (
                <tr key={r.id}>
                  <td>{r.round_name ?? '—'}</td><td>{formatDate(r.date)}</td><td>{formatInr(r.amount_inr)}</td><td>{formatInr(r.valuation_inr)}</td><td>{r.lead_investor ?? '—'}</td>
                  <td><button className={styles.rowRemove} onClick={() => startTransition(async () => { await deleteFundingRound(r.id, company.id); onChanged() })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Cap table ─────────────────────────────────────────────────────────────────
function CapTableSection({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ holder_name: '', holder_type: 'investor', pct: '', notes: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  function submit() {
    if (!form.holder_name.trim()) return
    startTransition(async () => {
      await saveCapTableEntry(company.id, {
        holder_name: form.holder_name.trim(), holder_type: form.holder_type as 'founder' | 'investor' | 'esop' | 'other',
        pct: form.pct ? Number(form.pct) : null, notes: form.notes.trim() || null, sort_order: company.cap_table.length,
      })
      setForm({ holder_name: '', holder_type: 'investor', pct: '', notes: '' }); setAdding(false); onChanged()
    })
  }
  return (
    <div className={styles.section}>
      <SectionHead title="Cap table" action={<button className={styles.smallBtn} onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add holder'}</button>} />
      {adding && (
        <div className={styles.inlineForm}>
          <input className={styles.input} placeholder="Holder name" value={form.holder_name} onChange={(e) => set('holder_name', e.target.value)} />
          <select className={styles.select} value={form.holder_type} onChange={(e) => set('holder_type', e.target.value)}>
            <option value="founder">Founder</option><option value="investor">Investor</option><option value="esop">ESOP</option><option value="other">Other</option>
          </select>
          <input className={styles.input} placeholder="%" inputMode="numeric" value={form.pct} onChange={(e) => set('pct', e.target.value)} />
          <input className={styles.input} placeholder="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>{pending ? 'Adding…' : 'Add'}</button>
        </div>
      )}
      {company.cap_table.length === 0 && !adding ? <div className={styles.muted}>No cap table recorded.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Holder</th><th>Type</th><th>%</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {company.cap_table.map((r) => (
                <tr key={r.id}>
                  <td>{r.holder_name}</td><td>{r.holder_type ?? '—'}</td><td>{r.pct != null ? `${r.pct}%` : '—'}</td><td>{r.notes ?? '—'}</td>
                  <td><button className={styles.rowRemove} onClick={() => startTransition(async () => { await deleteCapTableEntry(r.id, company.id); onChanged() })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Documents ─────────────────────────────────────────────────────────────────
function DocumentsSection({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ label: '', doc_type: 'other' as CompanyDocType, url: '' })
  function submit() {
    if (!form.label.trim() || !form.url.trim()) return
    startTransition(async () => { await addDocument(company.id, form.label, form.doc_type, form.url); setForm({ label: '', doc_type: 'other', url: '' }); setAdding(false); onChanged() })
  }
  return (
    <div className={styles.section}>
      <SectionHead title="Documents & data room" action={<button className={styles.smallBtn} onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add link'}</button>} />
      {adding && (
        <div className={styles.inlineForm}>
          <input className={styles.input} placeholder="Label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          <select className={styles.select} value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value as CompanyDocType }))}>
            {COMPANY_DOC_TYPES.map((t) => <option key={t} value={t}>{COMPANY_DOC_TYPE_LABELS[t]}</option>)}
          </select>
          <input className={styles.input} placeholder="https://…" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>{pending ? 'Adding…' : 'Add'}</button>
        </div>
      )}
      {company.documents.length === 0 && !adding ? <div className={styles.muted}>No documents linked.</div> : (
        <div className={styles.docList}>
          {company.documents.map((d) => (
            <div key={d.id} className={styles.docRow}>
              <span className={styles.docType}>{COMPANY_DOC_TYPE_LABELS[d.doc_type]}</span>
              <a href={d.url} target="_blank" rel="noreferrer" className={styles.docLabel}>{d.label} ↗</a>
              <button className={styles.rowRemove} onClick={() => startTransition(async () => { await removeDocument(d.id, company.id); onChanged() })}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom fields ─────────────────────────────────────────────────────────────
function CustomFieldsSection({ company, fieldDefs, canManage, onChanged }: {
  company: Company; fieldDefs: CompanyFieldDef[]; canManage: boolean; onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [addingDef, setAddingDef] = useState(false)
  const [defLabel, setDefLabel] = useState('')
  const [defType, setDefType] = useState<CompanyFieldType>('text')
  const valueFor = (defId: string) => company.field_values.find((v) => v.field_def_id === defId)?.value ?? ''

  function saveValue(defId: string, value: string) {
    startTransition(async () => { await setFieldValue(company.id, defId, value); onChanged() })
  }
  function addDef() {
    if (!defLabel.trim()) return
    startTransition(async () => { await saveFieldDef({ label: defLabel, field_type: defType, position: fieldDefs.length }); setDefLabel(''); setAddingDef(false); onChanged() })
  }

  if (fieldDefs.length === 0 && !canManage) return null
  return (
    <div className={styles.section}>
      <SectionHead title="Custom fields" action={canManage ? <button className={styles.smallBtn} onClick={() => setAddingDef((v) => !v)}>{addingDef ? 'Cancel' : '+ Add field'}</button> : undefined} />
      {addingDef && (
        <div className={styles.inlineForm}>
          <input className={styles.input} placeholder="Field label" value={defLabel} onChange={(e) => setDefLabel(e.target.value)} />
          <select className={styles.select} value={defType} onChange={(e) => setDefType(e.target.value as CompanyFieldType)}>
            {COMPANY_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={addDef} disabled={pending}>Add field</button>
        </div>
      )}
      {fieldDefs.length === 0 ? <div className={styles.muted}>No custom fields defined.</div> : (
        <div className={styles.customGrid}>
          {fieldDefs.map((def) => (
            <div key={def.id} className={styles.field}>
              <label className={styles.fieldLabel}>{def.label}</label>
              <input
                className={styles.input}
                type={def.field_type === 'date' ? 'date' : def.field_type === 'url' ? 'url' : 'text'}
                inputMode={def.field_type === 'numeric' || def.field_type === 'percentage' ? 'numeric' : undefined}
                defaultValue={valueFor(def.id)}
                onBlur={(e) => { if (e.target.value !== valueFor(def.id)) saveValue(def.id, e.target.value) }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Meta-tags (aside) ─────────────────────────────────────────────────────────
function MetaTagsCard({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className={styles.asideCard}>
      <div className={styles.asideHead}>
        <span className={styles.asideTitle}>Themes</span>
        <button className={styles.smallBtn} onClick={() => startTransition(async () => { await suggestMetaTags(company.id); onChanged() })} disabled={pending} title="Extract themes from the company's text">
          {pending ? '…' : '↻ Suggest'}
        </button>
      </div>
      {company.meta_tags.length === 0 ? (
        <div className={styles.muted}>No themes yet. Click Suggest to extract from the description, or add them in Edit.</div>
      ) : (
        <div className={styles.chips}>{company.meta_tags.map((t) => <span key={t} className={styles.metaChip}>{t}</span>)}</div>
      )}
    </div>
  )
}

// ── Suggested investors (aside) ───────────────────────────────────────────────
const BUCKETS: Array<{ key: SuggestedInvestor['bucket']; label: string; hint: string }> = [
  { key: 'sector', label: 'Sector preference', hint: 'Their thesis covers this sector' },
  { key: 'synergy', label: 'Synergetic', hint: 'Matches a company theme' },
  { key: 'agnostic', label: 'Sector-agnostic', hint: 'Invests broadly' },
]

function ticketLabel(inv: SuggestedInvestor): string | null {
  if (inv.ticket_size_min == null && inv.ticket_size_max == null) return null
  if (inv.ticket_size_min != null && inv.ticket_size_max != null) return `${formatInr(inv.ticket_size_min)}–${formatInr(inv.ticket_size_max)}`
  return formatInr(inv.ticket_size_min ?? inv.ticket_size_max)
}

function SuggestedInvestorsPanel({ suggestions }: { suggestions: SuggestedInvestor[] }) {
  return (
    <div className={styles.asideCard}>
      <div className={styles.asideTitle}>Suggested investors</div>
      {suggestions.length === 0 ? (
        <div className={styles.muted}>No matches yet — add sectors/themes to this company, or investors to the database.</div>
      ) : (
        BUCKETS.map((b) => {
          const items = suggestions.filter((s) => s.bucket === b.key)
          if (items.length === 0) return null
          return (
            <div key={b.key} className={styles.invGroup}>
              <div className={styles.invGroupHead}>
                <span className={`${styles.invBucket} ${styles[`bucket_${b.key}`]}`}>{b.label}</span>
                <span className={styles.muted} title={b.hint}>{items.length}</span>
              </div>
              {items.map((inv) => {
                const ticket = ticketLabel(inv)
                return (
                  <div key={inv.id} className={styles.invRow}>
                    <div className={styles.invName}>
                      {inv.name}
                      {inv.stageFit && <span className={styles.stageFit} title="Stage fit">◎</span>}
                    </div>
                    <div className={styles.invMeta}>
                      {SERVICE_TYPE_LABELS[inv.service_type]}
                      {inv.reasons.length > 0 && <> · {inv.reasons.join(', ')}</>}
                    </div>
                    {ticket && <div className={styles.invTicket}>{ticket} ticket</div>}
                  </div>
                )
              })}
            </div>
          )
        })
      )}
      <Link href="/investors" className={styles.asideLink}>View all investors →</Link>
    </div>
  )
}

// ── Updates timeline ──────────────────────────────────────────────────────────
function UpdatesSection({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState('')
  function submit() {
    if (!text.trim()) return
    startTransition(async () => { await addUpdate(company.id, text); setText(''); onChanged() })
  }
  return (
    <div className={styles.section}>
      <SectionHead title="Updates" />
      <div className={styles.updateComposer}>
        <textarea className={styles.textarea} placeholder="Add an update…" value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        <button className={styles.primaryBtn} onClick={submit} disabled={pending || !text.trim()}>{pending ? 'Posting…' : 'Post'}</button>
      </div>
      {company.updates.length === 0 ? <div className={styles.muted}>No updates yet.</div> : (
        <div className={styles.timeline}>
          {company.updates.map((u) => (
            <div key={u.id} className={styles.update}>
              <div className={styles.updateHead}>
                <span className={styles.updateAuthor}>{u.author?.name ?? 'Someone'}</span>
                <span className={styles.updateDate}>{formatDate(u.created_at)}</span>
                <button className={styles.rowRemove} onClick={() => startTransition(async () => { await deleteUpdate(u.id, company.id); onChanged() })}>×</button>
              </div>
              <div className={styles.updateBody}>{u.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
