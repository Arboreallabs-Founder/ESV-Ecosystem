'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import { getVenturePartnerAccess, setDealPartnerAccess } from '@/app/actions/active-deals'
import styles from '../active-deals.module.css'

/**
 * Which venture partners are on this deal.
 *
 * SGPs are deliberately absent from the list. Their access is the blanket "visible to partners"
 * toggle beside this, and showing them here with a checkbox would imply a per-deal control that
 * does nothing — the database consults these grants only for venture-tier partners
 * (20261020000000).
 *
 * Loaded on open rather than with the page: most deal views never touch it, and a venture partner
 * roster is one more query on every deal page for a panel nobody opened.
 */
export default function VenturePartnerAccess({ dealId, dealVisibleToPartners }: {
  dealId: string
  dealVisibleToPartners: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [partners, setPartners] = useState<Array<{ id: string; name: string }> | null>(null)
  const [granted, setGranted] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  // Fetched from the click rather than an effect watching `open`: opening the panel is the event,
  // and an effect would be a second source of truth for when the load happens.
  async function openPanel() {
    setOpen((v) => !v)
    if (partners) return
    setLoading(true)
    try {
      const res = await getVenturePartnerAccess(dealId)
      setPartners(res.partners)
      setGranted(res.granted)
    } catch (err) {
      alertError(err)
    } finally {
      setLoading(false)
    }
  }

  function toggle(partnerId: string) {
    const next = granted.includes(partnerId)
      ? granted.filter((id) => id !== partnerId)
      : [...granted, partnerId]
    setGranted(next)
    startTransition(async () => {
      try {
        await setDealPartnerAccess(dealId, next)
        router.refresh()
      } catch (err) {
        // Put the checkbox back where it was: a tick that stays after a refused write is a claim
        // that someone can see a deal they cannot.
        setGranted(granted)
        alertError(err)
      }
    })
  }

  return (
    <div className={styles.ventureAccess}>
      <button type="button" className={styles.ghostBtn} onClick={openPanel}>
        Venture partners{granted.length > 0 ? ` (${granted.length})` : ''}
      </button>

      {open && (
        <div className={styles.venturePanel}>
          {loading && <p className={styles.ventureHint}>Loading…</p>}

          {partners && partners.length === 0 && (
            <p className={styles.ventureHint}>
              No venture partners yet. Set a partner&apos;s tier to Venture Partner in Admin →
              Partners, and they will appear here.
            </p>
          )}

          {partners && partners.length > 0 && (
            <>
              <ul className={styles.ventureList}>
                {partners.map((p) => (
                  <li key={p.id}>
                    <label className={styles.ventureRow}>
                      <input
                        type="checkbox"
                        checked={granted.includes(p.id)}
                        disabled={pending}
                        onChange={() => toggle(p.id)}
                      />
                      <span>{p.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className={styles.ventureHint}>
                A venture partner sees only the deals ticked here. SGPs are not listed — they see
                every deal the toggle beside this leaves visible.
              </p>
              {!dealVisibleToPartners && granted.length > 0 && (
                <p className={styles.ventureWarn}>
                  This deal is hidden from partners, so nobody ticked here can open it. Make it
                  visible to partners for these grants to take effect.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
