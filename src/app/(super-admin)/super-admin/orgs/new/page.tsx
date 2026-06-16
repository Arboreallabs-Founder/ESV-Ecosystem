'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrganization } from '@/app/actions/super-admin'
import styles from '../../../super-admin.module.css'

export default function NewOrgPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleNameChange(val: string) {
    setName(val)
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const id = await createOrganization(name, slug)
        router.push(`/super-admin/orgs/${id}`)
      } catch (err) {
        setError(String(err))
      }
    })
  }

  return (
    <>
      <Link href="/super-admin/orgs" className={styles.backLink}>
        ← Back to Organisations
      </Link>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>New Organisation</h1>
      </div>

      <div className={styles.formCard}>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Organisation Name *</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Accel India"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Slug *</label>
            <input
              className={styles.input}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. accel-india"
              required
            />
            <p className={styles.hint}>URL-safe identifier. Auto-generated from name, edit if needed.</p>
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn} disabled={isPending || !name.trim() || !slug.trim()}>
              {isPending ? 'Creating…' : 'Create Organisation'}
            </button>
            <Link href="/super-admin/orgs" className={styles.secondaryBtn}>Cancel</Link>
          </div>
        </form>
      </div>
    </>
  )
}
