'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addApprovedUser, updateApprovedUser, revokeUser } from '@/app/actions/admin'
import type { ApprovedUser } from '@/lib/types'
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

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export default function UsersTable({
  approvedUsers: initial,
  currentUserEmail,
}: {
  approvedUsers: ApprovedUser[]
  currentUserEmail: string
}) {
  const router = useRouter()
  const [users, setUsers] = useState(initial)
  const [isPending, startTransition] = useTransition()

  // Add modal
  const [showAdd, setShowAdd] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<string>('associate')
  const [addPassword, setAddPassword] = useState('')
  const [addError, setAddError] = useState('')

  // Edit modal
  const [editTarget, setEditTarget] = useState<ApprovedUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<string>('')

  // Revoke modal
  const [revokeTarget, setRevokeTarget] = useState<ApprovedUser | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  function openEdit(u: ApprovedUser) {
    setEditTarget(u)
    setEditName(u.name)
    setEditRole(u.role)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    startTransition(async () => {
      try {
        await addApprovedUser(addEmail, addName, addRole, addPassword || undefined)
        setUsers((prev) => [...prev, {
          email: addEmail.toLowerCase().trim(),
          name: addName.trim(),
          role: addRole as ApprovedUser['role'],
          added_at: new Date().toISOString(),
          org_id: null,
          userId: null,
          hasLoggedIn: false,
        }])
        setShowAdd(false)
        setAddEmail(''); setAddName(''); setAddRole('associate'); setAddPassword('')
      } catch (err) {
        setAddError(String(err))
      }
    })
  }

  function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    startTransition(async () => {
      await updateApprovedUser(editTarget.email, editName, editRole, editTarget.userId)
      setUsers((prev) => prev.map((u) =>
        u.email === editTarget.email
          ? { ...u, name: editName.trim(), role: editRole as ApprovedUser['role'] }
          : u
      ))
      setEditTarget(null)
      router.refresh()
    })
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    setRevokeError('')
    try {
      await revokeUser(revokeTarget.email, revokeTarget.userId)
      setUsers((prev) => prev.filter((u) => u.email !== revokeTarget.email))
      setRevokeTarget(null)
      router.refresh()
    } catch (err) {
      setRevokeError(String(err))
    }
    setRevoking(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>User Management</div>
          <div className={styles.pageSub}>{users.length} approved user{users.length !== 1 ? 's' : ''}</div>
        </div>
        <button className={styles.addBtn} onClick={() => { setAddError(''); setShowAdd(true) }}>
          + Add Approved User
        </button>
      </div>

      {users.length === 0 ? (
        <div className={styles.empty}>No approved users yet. Add one to get started.</div>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td>
                    <div className={styles.name}>
                      {u.name || '—'}
                      {u.email === currentUserEmail && (
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
                    {u.hasLoggedIn ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        fontSize: '0.8125rem', fontWeight: 500, color: '#16a34a',
                      }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                        Active
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-warning)',
                      }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-warning)', display: 'inline-block' }} />
                        Pending
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit user"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '30px', height: '30px',
                          border: '1.5px solid var(--color-border)', borderRadius: '6px',
                          background: 'none', color: 'var(--color-primary)', cursor: 'pointer',
                        }}
                      >
                        <PencilIcon />
                      </button>
                      {u.email !== currentUserEmail && (
                        <button
                          onClick={() => { setRevokeError(''); setRevokeTarget(u) }}
                          title="Revoke access"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '30px', height: '30px',
                            border: '1.5px solid var(--color-destructive)', borderRadius: '6px',
                            background: 'none', color: 'var(--color-destructive)', cursor: 'pointer',
                          }}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Add Approved User</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '-1rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              This person will be able to sign in with their Google account once added.
            </p>
            <form onSubmit={handleAdd}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name *</label>
                <input className={styles.input} value={addName} onChange={(e) => setAddName(e.target.value)} required placeholder="Priya Sharma" autoFocus />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Google Email *</label>
                <input className={styles.input} type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} required placeholder="priya@earlyseed.vc" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Role *</label>
                <select className={styles.select} value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(optional)</span></label>
                <input
                  className={styles.input}
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="Leave blank if they'll sign in with Google"
                  autoComplete="new-password"
                />
              </div>
              {addError && <p style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem', marginBottom: '1rem' }}>{addError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>
                  {isPending ? 'Adding…' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setEditTarget(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Edit User</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '-1rem', marginBottom: '1.5rem' }}>
              {editTarget.email}
            </p>
            <form onSubmit={handleEditSave}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name *</label>
                <input className={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} required autoFocus />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Role</label>
                {editTarget.email === currentUserEmail ? (
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', padding: '0.5rem 0' }}>Cannot change your own role</div>
                ) : (
                  <select className={styles.select} value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                )}
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke modal */}
      {revokeTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setRevokeTarget(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Revoke Access</div>
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
              Remove <strong>{revokeTarget.name || revokeTarget.email}</strong> from the approved list?
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
              {revokeTarget.hasLoggedIn
                ? 'Their account and all access will be permanently deleted. This cannot be undone.'
                : 'They will no longer be able to sign in. This cannot be undone.'}
            </p>
            {revokeError && <p style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem', marginBottom: '1rem' }}>{revokeError}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                style={{
                  padding: '0.5rem 1.25rem', background: 'var(--color-destructive)', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem',
                  fontWeight: 600, cursor: 'pointer', opacity: revoking ? 0.6 : 1,
                }}
              >
                {revoking ? 'Revoking…' : 'Revoke Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
