'use client'

import { useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { addOrgUser } from '@/app/actions/super-admin'
import styles from '../../../../../super-admin.module.css'

const ROLES = [
  { value: 'founder', label: 'Founder' },
  { value: 'admin', label: 'Admin' },
  { value: 'associate', label: 'Associate' },
  { value: 'franchise_partner', label: 'Franchise Partner' },
]

export default function AddOrgUserPage() {
  const router = useRouter()
  const params = useParams()
  const orgId = params.orgId as string

  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('associate')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !name.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await addOrgUser(orgId, email, name, role)
        router.push(`/super-admin/orgs/${orgId}`)
      } catch (err) {
        setError(String(err))
      }
    })
  }

  return (
    <>
      <Link href={`/super-admin/orgs/${orgId}`} className={styles.backLink}>
        ← Back to Organisation
      </Link>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Add User</h1>
      </div>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', marginTop: '-1rem' }}>
        The user will be able to sign in with Google OAuth or email/password once added.
      </p>

      <div className={styles.formCard}>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Full Name *</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email Address *</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priya@accel.com"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Role *</label>
            <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn} disabled={isPending || !email.trim() || !name.trim()}>
              {isPending ? 'Adding…' : 'Add User'}
            </button>
            <Link href={`/super-admin/orgs/${orgId}`} className={styles.secondaryBtn}>Cancel</Link>
          </div>
        </form>
      </div>
    </>
  )
}
