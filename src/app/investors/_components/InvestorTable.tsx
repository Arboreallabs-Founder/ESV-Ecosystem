'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createInvestor } from '@/app/actions/investors'
import type { Investor } from '@/lib/types'
import styles from '../investors.module.css'

function formatCheque(min: number | null, max: number | null) {
  if (!min && !max) return '—'
  const fmt = (n: number) => n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(0)}L` : `₹${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

export default function InvestorTable({
  investors: initialInvestors,
  userRole,
}: {
  investors: Investor[]
  userRole: string
}) {
  const router = useRouter()
  const [investors, setInvestors] = useState(initialInvestors)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const canEdit = ['founder', 'admin', 'associate'].includes(userRole)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return investors
    return investors.filter(
      (inv) =>
        inv.fund_name.toLowerCase().includes(q) ||
        inv.contact_name.toLowerCase().includes(q) ||
        inv.contact_email.toLowerCase().includes(q) ||
        (inv.thesis ?? '').toLowerCase().includes(q) ||
        (inv.stage_pref ?? '').toLowerCase().includes(q),
    )
  }, [investors, search])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createInvestor(formData)
      setShowModal(false)
      router.refresh()
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Investors</div>
          <div className={styles.pageSub}>{investors.length} fund{investors.length !== 1 ? 's' : ''} in database</div>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search funds…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canEdit && (
            <button className={styles.addBtn} onClick={() => setShowModal(true)}>
              + Add Investor
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {investors.length === 0 ? 'No investors yet. Add the first fund.' : 'No results match your search.'}
        </div>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
            <thead>
              <tr>
                <th>Fund</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Thesis</th>
                <th>Stage Pref</th>
                <th>Cheque Range</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td><div className={styles.fundName}>{inv.fund_name}</div></td>
                  <td>{inv.contact_name}</td>
                  <td>
                    <a className={styles.emailLink} href={`mailto:${inv.contact_email}`}>
                      {inv.contact_email}
                    </a>
                  </td>
                  <td>{inv.thesis ?? <span style={{ color: 'var(--color-muted)' }}>—</span>}</td>
                  <td>{inv.stage_pref ?? <span style={{ color: 'var(--color-muted)' }}>—</span>}</td>
                  <td><span className={styles.cheque}>{formatCheque(inv.cheque_size_min, inv.cheque_size_max)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}

      {showModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Add Investor</div>
            <form onSubmit={handleSubmit}>
              <div className={styles.grid2}>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>Fund Name *</label>
                  <input className={styles.input} name="fund_name" required placeholder="Accel Partners" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Contact Name *</label>
                  <input className={styles.input} name="contact_name" required placeholder="Jane Smith" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Contact Email *</label>
                  <input className={styles.input} name="contact_email" type="email" required placeholder="jane@fund.com" />
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>Investment Thesis</label>
                  <textarea className={styles.textarea} name="thesis" placeholder="Sector focus, geography, thesis…" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Stage Preference</label>
                  <input className={styles.input} name="stage_pref" placeholder="Pre-Seed, Seed…" />
                </div>
                <div className={styles.field}>
                  {/* spacer */}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Cheque Min (₹)</label>
                  <input className={styles.input} name="cheque_size_min" type="number" min="0" placeholder="5000000" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Cheque Max (₹)</label>
                  <input className={styles.input} name="cheque_size_max" type="number" min="0" placeholder="50000000" />
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Add Investor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
