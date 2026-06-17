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
  onSelect: (investorId: string) => void
  onCreateNew: () => void
  onClose: () => void
}

export default function InvestorPickerModal({ allInvestors, alreadyAdded, onSelect, onCreateNew, onClose }: Props) {
  const [search, setSearch] = useState('')

  const available = allInvestors.filter(
    (inv) => !alreadyAdded.includes(inv.id) &&
      inv.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalPanel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Add Investor</span>
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
              available.map((inv) => (
                <button key={inv.id} className={styles.pickerRow} onClick={() => { onSelect(inv.id); onClose() }}>
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
              ))
            )}
          </div>
          <button className={styles.pickerCreateBtn} onClick={() => { onCreateNew(); onClose() }}>
            + Create New Investor
          </button>
        </div>
      </div>
    </div>
  )
}
