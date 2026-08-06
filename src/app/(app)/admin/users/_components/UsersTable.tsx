'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addApprovedUser, updateApprovedUser, revokeUser, setUserPhotoFromUrl } from '@/app/actions/admin'
import { setSgpCoordinator } from '@/app/actions/partner-companies'
import type { ApprovedUser } from '@/lib/types'
import { personInitials } from '@/app/_components/Avatar'
import styles from '../../admin.module.css'

const ROLES = ['founder', 'admin', 'associate', 'franchise_partner', 'general', 'hr'] as const

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', admin: 'Admin', associate: 'Associate', franchise_partner: 'Partner', general: 'General', hr: 'HR',
}

const ROLE_CLASS: Record<string, string> = {
  founder: styles.roleFounder,
  admin: styles.roleAdmin,
  associate: styles.roleAssociate,
  franchise_partner: styles.roleFranchise,
  general: styles.roleGeneral,
  hr: styles.roleHr,
}

function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
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
  const [editDesignation, setEditDesignation] = useState('')
  const [editCoordinator, setEditCoordinator] = useState(false)

  // Revoke modal
  const [photoTarget, setPhotoTarget] = useState<ApprovedUser | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoSaving, setPhotoSaving] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApprovedUser | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  function openPhoto(u: ApprovedUser) {
    setPhotoTarget(u)
    setPhotoUrl(u.photo_url ?? '')
    setPhotoError('')
  }

  function savePhoto() {
    if (!photoTarget?.userId) return
    setPhotoError('')
    setPhotoSaving(true)
    startTransition(async () => {
      try {
        await setUserPhotoFromUrl(photoTarget.userId!, photoUrl.trim() || null)
        setPhotoTarget(null)
        router.refresh()
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : String(err))
      } finally {
        setPhotoSaving(false)
      }
    })
  }

  function openEdit(u: ApprovedUser) {
    setEditTarget(u)
    setEditName(u.name)
    setEditRole(u.role)
    setEditDesignation(u.designation ?? '')
    setEditCoordinator(u.is_sgp_coordinator)
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
          photo_url: null,
          designation: null,
          is_sgp_coordinator: false,
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
      await updateApprovedUser(
        editTarget.email, editName, editRole, editTarget.userId,
        editTarget.userId ? editDesignation : undefined,
      )
      // Separate action: the coordinator flag decides who sees every partner's leads, so it is
      // founder/admin-only and lives apart from the ordinary profile edit.
      if (editTarget.userId && editCoordinator !== editTarget.is_sgp_coordinator) {
        await setSgpCoordinator(editTarget.userId, editCoordinator)
      }
      setUsers((prev) => prev.map((u) =>
        u.email === editTarget.email
          ? {
              ...u,
              name: editName.trim(),
              role: editRole as ApprovedUser['role'],
              designation: editTarget.userId ? (editDesignation.trim() || null) : u.designation,
              is_sgp_coordinator: editTarget.userId ? editCoordinator : u.is_sgp_coordinator,
            }
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
                <th style={{ width: '52px' }} aria-label="Photo" />
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
                    {/* Only signed-in users have a `users` row to hang a photo on; an
                        approved-but-never-logged-in invite has nowhere to put one yet. */}
                    <button
                      type="button"
                      className={styles.avatarBtn}
                      onClick={() => u.userId && openPhoto(u)}
                      disabled={!u.userId}
                      title={u.userId ? 'Set profile photo' : 'They need to sign in before a photo can be set'}
                    >
                      {u.photo_url
                        ? <img src={u.photo_url} alt="" className={styles.avatarImg} />
                        : <span className={styles.avatarInitials}>{personInitials(u.name, u.email)}</span>}
                      {u.userId && <span className={styles.avatarOverlay}><CameraIcon /></span>}
                    </button>
                  </td>
                  <td>
                    <div className={styles.name}>
                      {u.name || '—'}
                      {u.email === currentUserEmail && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-muted)', marginLeft: '0.375rem' }}>(you)</span>
                      )}
                    </div>
                    {u.designation && <div className={styles.designation}>{u.designation}</div>}
                    {u.is_sgp_coordinator && <div className={styles.coordinatorTag}>SGP Coordinator</div>}
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
                <label className={styles.label}>Job Title</label>
                {editTarget.userId ? (
                  <>
                    <input
                      className={styles.input}
                      value={editDesignation}
                      onChange={(e) => setEditDesignation(e.target.value)}
                      placeholder="e.g. Senior Investment Associate"
                    />
                    <span className={styles.fieldHint}>
                      Their specific title. Appears on their ID card and on generated letters —
                      separate from the permission role below.
                    </span>
                  </>
                ) : (
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', padding: '0.5rem 0' }}>
                    They need to sign in before a job title can be set.
                  </div>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Permission Role</label>
                {editTarget.email === currentUserEmail ? (
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', padding: '0.5rem 0' }}>Cannot change your own role</div>
                ) : (
                  <select className={styles.select} value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                )}
              </div>
              {editTarget.userId && ['associate', 'admin', 'founder'].includes(editRole) && (
                <div className={styles.field}>
                  <label className={styles.coordinatorRow}>
                    <input
                      type="checkbox"
                      checked={editCoordinator}
                      onChange={(e) => setEditCoordinator(e.target.checked)}
                    />
                    SGP Coordinator
                  </label>
                  <span className={styles.fieldHint}>
                    Triages companies submitted by partners on the SGP Desk, and can assign them to
                    an associate or general user. Founders and admins can always do this.
                  </span>
                </div>
              )}
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
      {photoTarget && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setPhotoTarget(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Profile photo</div>
            <p className={styles.modalSub}>
              Paste a link to an image for {photoTarget.name || photoTarget.email}. We download it
              once and serve our own copy, so it keeps working after the original link expires —
              LinkedIn photo links in particular are time-limited.
            </p>

            <div className={styles.photoPreviewRow}>
              <span className={styles.photoPreview}>
                {photoUrl.trim()
                  ? <img src={photoUrl} alt="" />
                  : <span className={styles.avatarInitials}>{personInitials(photoTarget.name, photoTarget.email)}</span>}
              </span>
              <div className={styles.photoField}>
                <label className={styles.label}>Image URL</label>
                <input
                  className={styles.input}
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://…"
                  autoFocus
                />
                <span className={styles.photoHint}>
                  Must link to the image itself, not the page it sits on — right-click the photo
                  and choose &ldquo;Copy image address&rdquo;. Leave blank to remove.
                </span>
              </div>
            </div>

            {photoError && <div className={styles.errorText}>{photoError}</div>}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setPhotoTarget(null)} disabled={photoSaving}>
                Cancel
              </button>
              <button className={styles.submitBtn} onClick={savePhoto} disabled={photoSaving}>
                {photoSaving ? 'Saving…' : 'Save photo'}
              </button>
            </div>
          </div>
        </div>
      )}

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
