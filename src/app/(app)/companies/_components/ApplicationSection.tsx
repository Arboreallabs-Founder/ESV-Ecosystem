'use client'

import { useState } from 'react'
import type { ApplicationAnswer, CompanyApplication } from '@/lib/company-applications'
import { formatDate } from './format'
import base from '../companies.module.css'
import styles from './application.module.css'

/* Short labels for tagged questions. The full question is the tooltip; untagged questions fall back
   to their own wording. Keys are form_nodes.field_key / contact_field (20261012000000, 20260928). */
const LABELS: Record<string, string> = {
  company_name: 'Company', website: 'Website / LinkedIn', sector_primary: 'Sector', sector_secondary: 'Second sector',
  business_stage: 'Stage', entity: 'Registered as',
  name: 'Name', email: 'Email', phone: 'Phone', founder_linkedin: 'LinkedIn',
  annual_revenue: 'Turnover, last FY', revenue_ytd: 'Revenue this FY', monthly_revenue: 'Revenue, last month',
  raised_before: 'Raised before', raised_detail: 'Previous rounds', valuation: 'Valuation (this round)',
  ask: 'Raising', soft_commitments: 'Soft commitments', soft_detail: 'Commitment details', deck_url: 'Pitch deck',
  prefunding_interest: 'Pre-funding services', predocs: 'Pre-funding documents ready', prefunding_detail: 'Pre-funding needs',
  incorporation_help: 'Incorporation help', fundraising_services: 'Fundraising services', digital_marketing: 'Digital marketing',
  community: 'Founder community',
}

const GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: 'Company', keys: ['company_name', 'website', 'sector_primary', 'sector_secondary', 'business_stage', 'entity'] },
  { title: 'Founder', keys: ['name', 'email', 'phone', 'founder_linkedin'] },
  { title: 'Traction', keys: ['annual_revenue', 'revenue_ytd', 'monthly_revenue'] },
  { title: 'Funding', keys: ['raised_before', 'raised_detail', 'valuation', 'ask', 'soft_commitments', 'soft_detail', 'deck_url'] },
  { title: 'Services they asked about', keys: ['prefunding_interest', 'predocs', 'prefunding_detail', 'incorporation_help', 'fundraising_services', 'digital_marketing', 'community'] },
]

const LONG = new Set(['raised_detail', 'soft_detail', 'prefunding_detail', 'fundraising_services'])

/* Yes/no services, surfaced as highlights: these are what tell the team what to offer. */
const WANTS: Array<{ key: string; label: string }> = [
  { key: 'prefunding_interest', label: 'Pre-funding services' },
  { key: 'incorporation_help', label: 'Incorporation help' },
  { key: 'digital_marketing', label: 'Digital marketing' },
  { key: 'community', label: 'Founder community' },
]

function keyOf(a: ApplicationAnswer): string | null {
  return a.key ?? a.contact
}

function Value({ text }: { text: string }) {
  const t = text.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return <a href={`mailto:${t}`}>{t}</a>
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) {
    const href = t.startsWith('http') ? t : `https://${t}`
    return <a href={href} target="_blank" rel="noreferrer">{t.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')} ↗</a>
  }
  return <>{t}</>
}

export default function ApplicationSection({ applications }: { applications: CompanyApplication[] }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(true)
  if (applications.length === 0) return null

  const app = applications[Math.min(index, applications.length - 1)]
  const byKey = new Map<string, ApplicationAnswer>()
  for (const a of app.answers) { const k = keyOf(a); if (k && !byKey.has(k)) byKey.set(k, a) }
  // A form that never asked who they are collects name/email in the renderer's final step, which
  // lands on the entry rather than as answers — show those in the Founder group all the same.
  if (!byKey.has('name') && app.submitterName) byKey.set('name', { question: 'Name', answer: app.submitterName, key: null, contact: 'name', order: 0 })
  if (!byKey.has('email') && app.submitterEmail) byKey.set('email', { question: 'Email', answer: app.submitterEmail, key: null, contact: 'email', order: 0 })
  const grouped = new Set(GROUPS.flatMap((g) => g.keys))
  const other = app.answers.filter((a) => { const k = keyOf(a); return !k || !grouped.has(k) })

  const wants = WANTS.filter((w) => /^yes/i.test(byKey.get(w.key)?.answer ?? '')).map((w) => w.label)
  if (byKey.get('fundraising_services')?.answer) wants.push('Fundraising services')

  const groups = [
    ...GROUPS.map((g) => ({ title: g.title, rows: g.keys.map((k) => byKey.get(k)).filter((a): a is ApplicationAnswer => !!a) })),
    { title: 'Other answers', rows: other },
  ].filter((g) => g.rows.length > 0)

  return (
    <div className={base.section}>
      <div className={base.sectionHead}>
        <h3 className={base.sectionTitle}>Application</h3>
        <button className={styles.toggle} onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'}</button>
      </div>
      <div className={styles.meta}>
        What the founder submitted · {formatDate(app.submittedAt)}
        {app.via && <> · via {app.via}</>}
        {app.formName && <> · {app.formName}</>}
      </div>

      {open && (
        <>
          {applications.length > 1 && (
            <div className={styles.switcher}>
              {applications.map((a, i) => (
                <button
                  key={a.id}
                  className={`${styles.switchBtn} ${i === index ? styles.switchBtnOn : ''}`}
                  onClick={() => setIndex(i)}
                >
                  {i === 0 ? 'Latest' : formatDate(a.submittedAt)}
                </button>
              ))}
            </div>
          )}

          {wants.length > 0 && (
            <div className={styles.wants}>
              <span className={styles.wantsLabel}>Interested in</span>
              {wants.map((w) => <span key={w} className={styles.want}>{w}</span>)}
            </div>
          )}

          <div className={styles.groups}>
            {groups.map((g) => (
              <div key={g.title} className={styles.group}>
                <div className={styles.groupTitle}>{g.title}</div>
                {g.rows.map((a, i) => {
                  const k = keyOf(a)
                  const long = (k && LONG.has(k)) || (!k && a.answer.length > 80)
                  return (
                    <div key={`${k ?? a.question}-${i}`} className={`${styles.row} ${long ? styles.rowStacked : ''}`}>
                      <div className={styles.label} title={a.question}>{(k && LABELS[k]) || a.question}</div>
                      <div className={styles.value}><Value text={a.answer} /></div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
