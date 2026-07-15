'use client'

import { useState } from 'react'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import styles from '../active-deals.module.css'

type PickerInvestor = {
  id: string
  name: string
  service_type: string
  referred_by_partner_id: string | null
}

type Props = {
  allInvestors: PickerInvestor[]
  alreadyAdded: string[]
  onAdd: (investorIds: string[]) => void
  onCreateNew: () => void
  onClose: () => void
}

export default function InvestorPickerModal({ allInvestors, alreadyAdded, onAdd, onCreateNew, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const available = allInvestors.filter(
    (inv) => !alreadyAdded.includes(inv.id) &&
      inv.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function confirm() {
    if (selected.size === 0) return
    onAdd([...selected])
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalPanel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Add Investors</span>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <input
            className={styles.modalInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search investors…"
            autoFocus
          />
          <div className={styles.pickerList}>
            {available.length === 0 ? (
              <div className={styles.pickerEmpty}>No investors found.</div>
            ) : (
              available.map((inv) => {
                const checked = selected.has(inv.id)
                return (
                  <button
                    key={inv.id}
                    type="button"
                    className={`${styles.pickerRow} ${checked ? styles.pickerRowSelected : ''}`}
                    onClick={() => toggle(inv.id)}
                  >
                    <span className={styles.pickerCheck} aria-hidden>{checked ? '☑' : '☐'}</span>
                    <span className={styles.pickerName}>{inv.name}</span>
                    <span className={styles.pickerMeta}>
                      <span className={styles.investorTypeBadge}>
                        {(SERVICE_TYPE_LABELS as Record<string, string>)[inv.service_type] ?? inv.service_type}
                      </span>
                      {inv.referred_by_partner_id && (
                        <span className={styles.referralChip}>Referral</span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          <div className={styles.pickerFooter}>
            <button className={styles.pickerCreateBtn} onClick={() => { onCreateNew(); onClose() }}>
              + Create New Investor
            </button>
            <button className={styles.modalAccept} onClick={confirm} disabled={selected.size === 0}>
              Add {selected.size > 0 ? selected.size : ''} investor{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
