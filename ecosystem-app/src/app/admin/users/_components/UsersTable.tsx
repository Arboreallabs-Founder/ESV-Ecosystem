'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserRole } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/lib/types'
import styles from '../../admin.module.css'

const ROLES = ['founder', 'admin', 'associate', 'franchise_partner'] as const

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', admin: 'Admin', associate: 'Associate', franchise_partner: 'Partner',
}

const ROLE_CLASS: Record<string, string> = {
  founder: styles.roleFounder,
  admin: styles.roleAdmin,
  associate: styles.roleAssociate,
  franchise_partner: styles.roleFranchise,
}

export default function UsersTable({
  users: initialUsers,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  function handleRoleChange(userId: string, newRole: string) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as UserRow['role'] } : u))
    startTransition(async () => {
      await updateUserRole(userId, newRole)
    })
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    const form = e.currentTarget
    const data = {
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      role: (form.elements.namedItem('role') as HTMLSelectElement).value,
    }

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(data),
        },
      )
      const result = await res.json()
      if (!res.ok) { setCreateError(result.error || 'Failed to create user'); setCreating(false); return }
      setShowCreate(false)
      setCreating(false)
      router.refresh()
    } catch (err) {
      setCreateError(String(err))
      setCreating(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>User Management</div>
          <div className={styles.pageSub}>{users.length} user{users.length !== 1 ? 's' : ''} registered</div>
        </div>
        <button className={styles.addBtn} onClick={() => setShowCreate(true)}>+ Create Account</button>
      </div>

      <div className={styles.tableWrap}>
        {users.length === 0 ? (
          <div className={styles.empty}>No users found.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.name}>
                      {u.name || '—'}
                      {u.id === currentUserId && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-muted)', marginLeft: '0.375rem' }}>(you)</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <a className={styles.emailLink} href={`mailto:${u.email}`}>{u.email}</a>
                  </td>
                  <td>
                    <span className={`${styles.roleBadge} ${ROLE_CLASS[u.role] ?? styles.roleAssociate}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td>
                    {u.id === currentUserId ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>Cannot change own role</span>
                    ) : (
                      <select
                        className={styles.roleSelect}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={isPending}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Create Team Account</div>
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name</label>
                <input className={styles.input} name="name" placeholder="Priya Sharma" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email *</label>
                <input className={styles.input} name="email" type="email" required placeholder="priya@earlyseed.vc" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Temporary Password *</label>
                <input className={styles.input} name="password" type="password" required minLength={8} placeholder="Min. 8 characters" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Role *</label>
                <select className={styles.select} name="role" defaultValue="associate">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {createError && (
                <p style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem', marginBottom: '1rem' }}>{createError}</p>
              )}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={creating}>
                  {creating ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
