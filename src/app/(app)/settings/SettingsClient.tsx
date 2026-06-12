'use client'

import { useState, useTransition } from 'react'
import { changePassword } from '@/app/actions/auth'
import { useTheme } from '@/app/_components/ThemeProvider'
import styles from './settings.module.css'

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', admin: 'Admin', associate: 'Associate', franchise_partner: 'Partner',
}

export default function SettingsClient({ name, email, role }: { name: string; email: string; role: string }) {
  const { theme, toggle: toggleTheme } = useTheme()

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleChangePw(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    if (newPw.length < 8) { setPwError('Must be at least 8 characters.'); return }
    startTransition(async () => {
      const result = await changePassword(newPw)
      if (result.error) { setPwError(result.error); return }
      setPwSuccess(true)
      setNewPw('')
      setConfirmPw('')
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.pageTitle}>Settings</div>
        <div className={styles.pageSub}>Manage your account and preferences</div>
      </div>

      <div className={styles.sections}>
        {/* Profile */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Profile</div>
          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Name</span>
              <span className={styles.infoVal}>{name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Email</span>
              <span className={styles.infoVal}>{email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Role</span>
              <span className={styles.infoVal}>{ROLE_LABELS[role] ?? role}</span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Appearance</div>
          <div className={styles.themeRow}>
            <div>
              <div className={styles.themeLabel}>Theme</div>
              <div className={styles.themeSub}>Currently: {theme === 'dark' ? 'Dark' : 'Light'}</div>
            </div>
            <button className={styles.themeBtn} onClick={toggleTheme}>
              {theme === 'dark' ? '☀ Switch to Light' : '🌙 Switch to Dark'}
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Change Password</div>
          <div className={styles.sectionDesc}>Set a new password for your account. Must be at least 8 characters.</div>
          {pwSuccess ? (
            <div className={styles.successMsg}>Password changed successfully.</div>
          ) : (
            <form onSubmit={handleChangePw} className={styles.pwForm}>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat password"
                  required
                />
              </div>
              {pwError && <div className={styles.errorMsg}>{pwError}</div>}
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitBtn} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
