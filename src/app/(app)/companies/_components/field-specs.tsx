// Shared field definitions for the company profile's editable scalar fields — used by both the
// per-section EditFieldsModal and the consolidated "Update from call" form, so the two stay in
// sync and share the same input rendering.
import type { Company } from '@/lib/types'
import { COMPANY_STATUSES, COMPANY_STATUS_LABELS } from '@/lib/types'
import type { CompanyPatch } from '@/app/actions/companies'
import { COUNTRY_OPTIONS } from '@/lib/countries'
import { SECTOR_OPTIONS, THESIS_TAG_OPTIONS } from '@/lib/taxonomies'
import Combobox from '@/app/_components/Combobox'
import TagSelect from '@/app/_components/TagSelect'
import styles from '../companies.module.css'

export type FieldType = 'text' | 'number' | 'percent' | 'textarea' | 'date' | 'tags' | 'status' | 'user' | 'country' | 'partner'
export type Spec = {
  key: keyof CompanyPatch; label: string; type?: FieldType; tagOptions?: string[]
  /** Hard cap on a text field, matched to the column's own CHECK. */
  maxLength?: number
  /** Sits under the input; for saying what a field is *for*, not what to type into it. */
  hint?: string
  /** Pick-only. Set on sectors: free text is what let three vocabularies grow, and a company
   *  tagged "Defense" against funds that say "Defence" matches nothing. */
  strictTags?: boolean
}

export function initValue(company: Company, spec: Spec): string {
  const v = (company as Record<string, unknown>)[spec.key as string]
  if (spec.type === 'tags') return Array.isArray(v) ? (v as string[]).join(', ') : ''
  if (v == null) return ''
  return String(v)
}
export function coerce(raw: string, type?: FieldType): unknown {
  const v = raw.trim()
  if (type === 'number' || type === 'percent') return v === '' ? null : Number(v)
  if (type === 'tags') return v === '' ? [] : v.split(',').map((s) => s.trim()).filter(Boolean)
  if (type === 'date') return v || null
  return v || null
}

export const OVERVIEW_SPECS: Spec[] = [
  { key: 'name', label: 'Name' }, { key: 'legal_name', label: 'Legal name' }, { key: 'website', label: 'Website' },
  { key: 'logo_url', label: 'Logo URL' }, { key: 'one_liner', label: 'One-liner' }, { key: 'description', label: 'Description', type: 'textarea' },
  {
    key: 'share_intro', label: 'Share introduction', type: 'textarea', maxLength: 200,
    hint: 'Used when a deal is shared on WhatsApp. The one-liner is written for a card; this is the '
      + 'sentence or two that makes someone open the deck. Falls back to the one-liner if left blank.',
  },
  { key: 'hq_city', label: 'HQ city' }, { key: 'hq_country', label: 'HQ country', type: 'country' }, { key: 'founded_date', label: 'Founded', type: 'date' },
  { key: 'incorporation_type', label: 'Incorporation type' }, { key: 'incorporation_no', label: 'Incorporation / CIN' },
  { key: 'sectors', label: 'Sectors', type: 'tags', tagOptions: SECTOR_OPTIONS, strictTags: true }, { key: 'stage', label: 'Stage' }, { key: 'business_model', label: 'Business model' },
  { key: 'status', label: 'Status', type: 'status' }, { key: 'tags', label: 'Tags', type: 'tags' },
  { key: 'meta_tags', label: 'Meta-tags (themes for investor matching)', type: 'tags', tagOptions: THESIS_TAG_OPTIONS },
  { key: 'esv_poc_id', label: 'ESV point of contact', type: 'user' },
  // "Referred by partner" is deliberately not here. It is a fee attribution, not a field: it takes
  // a coordinator and the founder, and the database refuses a direct write. The company profile
  // proposes it instead — see the Attribution block in CompanyProfileClient.
]
export const TRACTION_SPECS: Spec[] = [
  { key: 'arr_inr', label: 'ARR', type: 'number' }, { key: 'mrr_inr', label: 'MRR', type: 'number' }, { key: 'customers_count', label: 'Customers', type: 'number' },
  { key: 'team_size', label: 'Team size', type: 'number' }, { key: 'gross_margin_pct', label: 'Gross margin', type: 'percent' },
  { key: 'monthly_burn_inr', label: 'Monthly burn', type: 'number' }, { key: 'runway_months', label: 'Runway (months)', type: 'number' },
]
export const RAISE_SPECS: Spec[] = [
  { key: 'ask_inr', label: 'Ask', type: 'number' }, { key: 'instrument', label: 'Instrument' }, { key: 'round_status', label: 'Round status' },
  { key: 'pre_money_inr', label: 'Pre-money', type: 'number' }, { key: 'post_money_inr', label: 'Post-money', type: 'number' },
  { key: 'min_ticket_inr', label: 'Min ticket', type: 'number' }, { key: 'total_raised_inr', label: 'Total raised to date', type: 'number' },
  { key: 'use_of_funds', label: 'Use of funds', type: 'textarea' },
]
export const CAP_TABLE_SPECS: Spec[] = [
  { key: 'total_shares', label: 'Total number of shares', type: 'number' },
  { key: 'nominal_value_per_share', label: 'Nominal value (per share)', type: 'number' },
]
export const PRODUCT_SPECS: Spec[] = [
  { key: 'product_description', label: 'Product', type: 'textarea' }, { key: 'usp', label: 'USP', type: 'textarea' },
  { key: 'tech_stack', label: 'Tech stack' }, { key: 'product_links', label: 'Product links', type: 'tags' },
]

type Team = Array<{ id: string; name: string }>

/** The bare input/select/textarea for one spec — no label. */
export function SpecInput({ spec, value, onChange, team, partners = [] }: {
  spec: Spec; value: string; onChange: (v: string) => void; team: Team
  partners?: Array<{ id: string; name: string }>
}) {
  if (spec.type === 'textarea') {
    return (
      <textarea
        className={styles.textarea}
        value={value}
        maxLength={spec.maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  if (spec.type === 'status') {
    return (
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {COMPANY_STATUSES.map((o) => <option key={o} value={o}>{COMPANY_STATUS_LABELS[o]}</option>)}
      </select>
    )
  }
  if (spec.type === 'user') {
    return (
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    )
  }
  if (spec.type === 'partner') {
    return (
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not partner-sourced</option>
        {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    )
  }
  if (spec.type === 'country') {
    return <Combobox options={COUNTRY_OPTIONS} value={value} onChange={onChange} placeholder="Search country…" />
  }
  if (spec.type === 'tags' && spec.tagOptions) {
    const arr = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
    return (
      <TagSelect
        options={spec.tagOptions}
        value={arr}
        onChange={(vals) => onChange(vals.join(', '))}
        placeholder={`Search ${spec.label.toLowerCase()}…`}
        allowCustom={!spec.strictTags}
      />
    )
  }
  return (
    <input
      className={styles.input}
      type={spec.type === 'number' || spec.type === 'percent' ? 'text' : spec.type === 'date' ? 'date' : 'text'}
      inputMode={spec.type === 'number' || spec.type === 'percent' ? 'numeric' : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** A labelled field: label + input, matching the `.field` layout used across the profile's modals. */
export function SpecField({ spec, value, onChange, team, partners = [] }: {
  spec: Spec; value: string; onChange: (v: string) => void; team: Team
  partners?: Array<{ id: string; name: string }>
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{spec.label}{spec.type === 'percent' ? ' (%)' : spec.type === 'tags' && !spec.tagOptions ? ' (comma-separated)' : ''}</label>
      <SpecInput spec={spec} value={value} onChange={onChange} team={team} partners={partners} />
      {spec.maxLength && (
        <span className={styles.fieldCount}>{value.length}/{spec.maxLength}</span>
      )}
      {spec.hint && <span className={styles.fieldHint}>{spec.hint}</span>}
    </div>
  )
}
