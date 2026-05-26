'use client'

import { useState, useTransition } from 'react'
import { changePassword } from '@/app/actions/auth'

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (next !== confirm) { setError('Passwords do not match.'); return }
    if (next.length < 8) { setError('Must be at least 8 characters.'); return }

    startTransition(async () => {
      const result = await changePassword(next)
      if (result.error) { setError(result.error); return }
      setSuccess(true)
    })
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, padding: '1rem',
  }
  const modalStyle: React.CSSProperties = {
    background: 'var(--color-card)', borderRadius: 'var(--radius-lg)',
    padding: '2rem', width: '100%', maxWidth: 400,
    boxShadow: 'var(--shadow-elevated)',
  }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }
  const labelStyle: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-muted)' }
  const inputStyle: React.CSSProperties = {
    padding: '0.5625rem 0.875rem', border: '1.5px solid var(--color-border)',
    borderRadius: '8px', background: 'var(--color-bg)', color: 'var(--color-text)',
    fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1.5rem' }}>
          Change Password
        </div>

        {success ? (
          <div>
            <p style={{ color: 'var(--color-success)', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              ✓ Password changed successfully.
            </p>
            <button
              onClick={onClose}
              style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={fieldStyle}>
              <label style={labelStyle}>New Password</label>
              <input
                style={inputStyle} type="password" value={next}
                onChange={(e) => setNext(e.target.value)} required minLength={8}
                placeholder="Min. 8 characters"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                style={inputStyle} type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required
                placeholder="Repeat password"
              />
            </div>
            {error && (
              <p style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem', marginBottom: '1rem' }}>{error}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'none', border: '1.5px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-muted)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button type="submit" disabled={isPending} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: isPending ? 0.6 : 1 }}>
                {isPending ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
