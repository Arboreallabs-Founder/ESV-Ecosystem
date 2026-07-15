'use client'

import { useEffect, useState } from 'react'
import { getActiveDealsData } from '@/app/actions/active-deals'
import ActiveDealsList from './ActiveDealsList'
import Spinner from '@/app/_components/Spinner'
import type { ActiveDeal, DealCategory } from '@/lib/types'

export default function ActiveDealsOverlay({ onClose }: { onClose: () => void }) {
  const [deals, setDeals] = useState<ActiveDeal[]>([])
  const [categories, setCategories] = useState<DealCategory[]>([])
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActiveDealsData().then(({ deals, categories, userRole }) => {
      setDeals(deals)
      setCategories(categories)
      setUserRole(userRole)
      setLoading(false)
    })
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--color-bg)', display: 'flex', flexDirection: 'column',
      animation: 'fadeSlideIn 0.18s ease',
    }}>
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.875rem 2rem', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-card)', flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-muted)', fontSize: '0.875rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'inherit',
            padding: '0.25rem 0.5rem', borderRadius: '6px', transition: 'color 0.12s',
          }}
        >
          ← Back
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text)' }}>Active Deals</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Spinner size={28} label="Loading deals…" center />
        ) : (
          <div style={{ padding: '2rem' }}>
            <ActiveDealsList deals={deals} categories={categories} companyOptions={[]} userRole={userRole} />
          </div>
        )}
      </div>
    </div>
  )
}
