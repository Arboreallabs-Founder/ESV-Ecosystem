'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changePassword } from '@/app/actions/auth'
import { updateMyProfile, updateMyPhoto } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/app/_components/ThemeProvider'
import IdCard from '@/app/_components/IdCard'
import { updateMyIdPhoto } from '@/app/actions/profile'
import type { EmployeeProfile } from '@/lib/types'
import styles from './settings.module.css'

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', admin: 'Admin', associate: 'Associate', franchise_partner: 'Partner', general: 'General',
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function SettingsClient({
  userId, name, email, role, phone, designation, location, photoUrl, profile,
}: {
  userId: string
  name: string
  email: string
  role: string
  phone: string | null
  designation: string | null
  location: string | null
  photoUrl: string | null
  profile: EmployeeProfile | null
}) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const idFileInputRef = useRef<HTMLInputElement>(null)
  const [idPhotoPending, setIdPhotoPending] = useState(false)
  const [idPhotoError, setIdPhotoError] = useState('')

  const [profileName, setProfileName] = useState(name)
  const [profileDesignation, setProfileDesignation] = useState(designation ?? '')
  const [profilePhone, setProfilePhone] = useState(phone ?? '')
  const [profileLocation, setProfileLocation] = useState(location ?? '')
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [isProfilePending, startProfileTransition] = useTransition()

  const [photoError, setPhotoError] = useState('')
  const [photoPending, setPhotoPending] = useState(false)

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    if (!profileName.trim()) { setProfileError('Name is required.'); return }
    startProfileTransition(async () => {
      try {
        await updateMyProfile({
          name: profileName,
          phone: profilePhone || null,
          designation: profileDesignation || null,
          location: profileLocation || null,
        })
        setProfileSuccess(true)
        router.refresh()
      } catch (err) { setProfileError(err instanceof Error ? err.message : 'Could not save profile.') }
    })
  }

  async function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError('')
    if (file.size > MAX_PHOTO_BYTES) { setPhotoError('Photo must be under 5MB.'); return }
    setPhotoPending(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, file)
      if (upErr) throw new Error(upErr.message)
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(path)
      await updateMyPhoto(data.publicUrl)
      router.refresh()
    } catch (err) { setPhotoError(err instanceof Error ? err.message : 'Could not upload photo.') }
    finally { setPhotoPending(false) }
  }

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

  async function handleIdPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIdPhotoError('')
    if (file.size > MAX_PHOTO_BYTES) { setIdPhotoError('Photo must be under 5MB.'); return }
    setIdPhotoPending(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      // Fixed name so replacing your ID photo overwrites rather than accumulating orphans.
      const path = `${userId}/id-photo.${ext}`
      const { error: upErr } = await supabase.storage
        .from('profile-photos').upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(path)
      // Cache-buster: the path is stable across replacements, so without it a browser keeps
      // showing the previous photo.
      await updateMyIdPhoto(`${data.publicUrl}?v=${Date.now().toString(36)}`)
      router.refresh()
    } catch (err) {
      setIdPhotoError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setIdPhotoPending(false)
    }
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

          <div className={styles.avatarRow}>
            <div className={styles.avatar}>
              {photoUrl ? <img src={photoUrl} alt="" /> : initials(profileName || name)}
            </div>
            <div className={styles.avatarActions}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePickPhoto}
              />
              <button
                type="button"
                className={styles.changePhotoBtn}
                disabled={photoPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPending ? 'Uploading…' : 'Change photo'}
              </button>
              <span className={styles.photoHint}>JPG or PNG, up to 5MB.</span>
              {photoError && <span className={styles.errorMsg}>{photoError}</span>}
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input className={styles.input} value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Designation</label>
              <input
                className={styles.input}
                value={profileDesignation}
                onChange={(e) => setProfileDesignation(e.target.value)}
                placeholder="e.g. Senior Associate"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone</label>
              <input className={styles.input} type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Location</label>
              <input className={styles.input} value={profileLocation} onChange={(e) => setProfileLocation(e.target.value)} placeholder="e.g. Mumbai, India" />
            </div>
            <div className={styles.infoGrid} style={{ marginBottom: '1rem' }}>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Email</span>
                <span className={styles.infoVal}>{email}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Role</span>
                <span className={styles.infoVal}>{ROLE_LABELS[role] ?? role}</span>
              </div>
            </div>
            {profileError && <div className={styles.errorMsg}>{profileError}</div>}
            {profileSuccess && <div className={styles.successMsg} style={{ marginBottom: '0.75rem' }}>Profile updated.</div>}
            <div className={styles.formActions}>
              <button type="submit" className={styles.submitBtn} disabled={isProfilePending}>
                {isProfilePending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Appearance */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Appearance</div>
          <div className={styles.themeRow}>
            <div>
              <div className={styles.themeLabel}>Theme</div>
              <div className={styles.themeSub}>
                {theme === 'oled' ? 'OLED — true black, for OLED screens' : theme === 'dark' ? 'Dark' : 'Light'}
              </div>
            </div>
            <div className={styles.themeOptions}>
              <button
                type="button"
                className={`${styles.themeOption} ${theme === 'light' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('light')}
              >
                ☀ Light
              </button>
              <button
                type="button"
                className={`${styles.themeOption} ${theme === 'dark' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('dark')}
              >
                🌙 Dark
              </button>
              <button
                type="button"
                className={`${styles.themeOption} ${theme === 'oled' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('oled')}
              >
                ⬛ OLED
              </button>
            </div>
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

        {/* ── Digital ID card ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>ID Card</div>
          <div className={styles.sectionDesc}>
            Your digital employee ID. The photo here is separate from your profile picture on
            purpose — this one appears on an identity document, so it needs a photo you uploaded
            for that, not one mirrored in from a link.
          </div>

          {!profile ? (
            <div className={styles.sectionDesc} style={{ marginTop: '1rem' }}>
              Your employee profile has not been set up yet. Ask HR to create it and your ID card
              will appear here.
            </div>
          ) : (
            <div className={styles.idCardRow}>
              <IdCard name={name} designation={designation} profile={profile} printable />

              <div className={styles.idCardActions}>
                <input
                  ref={idFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleIdPhoto}
                />
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={() => idFileInputRef.current?.click()}
                  disabled={idPhotoPending}
                >
                  {idPhotoPending ? 'Uploading…' : profile.id_photo_url ? 'Replace ID photo' : 'Upload ID photo'}
                </button>
                <div className={styles.sectionDesc}>
                  A clear, front-facing photo. Under 5MB.
                </div>
                {idPhotoError && <div className={styles.errorMsg}>{idPhotoError}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
