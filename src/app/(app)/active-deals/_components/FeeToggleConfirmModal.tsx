'use client'

import { useState } from 'react'
import styles from '../active-deals.module.css'

type Props = {
  dealName: string
  feeLabel: string
  targetState: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function FeeToggleConfirmModal({ dealName, feeLabel, targetState, onConfirm, onClose }: Props) {
  const [input, setInput] = useState('')
  const matches = input.trim().toLowerCase() === dealName.trim().toLowerCase()

  return (
    <div className={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalPanel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Confirm fee {targetState ? 'enable' : 'disable'}</span>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalDesc}>
            You are {targetState ? 'enabling' : 'disabling'} <strong>{feeLabel}</strong> for this investor.
            {!targetState && ' Disabled fees are excluded from totals.'}
          </p>
          <p className={styles.modalDesc}>Type the deal name to confirm:</p>
          <div className={styles.modalHint}>{dealName}</div>
          <input
            className={styles.modalInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type deal name…"
            autoFocus
          />
          <div className={styles.modalActions}>
            <button className={styles.modalCancel} onClick={onClose}>Cancel</button>
            <button
              className={styles.modalAccept}
              disabled={!matches}
              onClick={() => { onConfirm(); onClose() }}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
