'use client'

import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { verifyPinAndLogin } from '@/app/actions/demo'
import styles from './page.module.css'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')
  const errorMsg = searchParams.get('msg')

  const authError =
    errorCode === 'not_approved'
      ? 'Your Google account has not been approved for access. Contact your administrator.'
    : errorCode === 'oauth'
      ? `Sign-in failed: ${errorMsg ?? 'unknown error'}`
    : errorCode === 'no_code'
      ? `OAuth callback received no code. Params: ${searchParams.get('params') ?? 'none'}. Set Auth flow type to PKCE in Supabase Dashboard → Authentication → Configuration.`
    : errorCode === 'no_session'
      ? 'Session could not be established after sign-in. Please try again.'
    : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')

  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isPinPending, startPinTransition] = useTransition()

  function handleDemoEnter(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length !== 4) return
    setPinError('')
    startPinTransition(async () => {
      try {
        await verifyPinAndLogin(pin)
        router.push('/dashboard')
      } catch (err) {
        setPinError(err instanceof Error ? err.message : 'Incorrect PIN')
      }
    })
  }

  async function handleGoogleSignIn() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')
    setEmailLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setEmailError('Invalid email or password.')
      setEmailLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setEmailError('Sign in failed. Please try again.')
      setEmailLoading(false)
      return
    }

    const { data: publicUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!publicUser) {
      await supabase.auth.signOut()
      setEmailError('Your account has not been approved for access. Contact your administrator.')
      setEmailLoading(false)
      return
    }

    router.push(publicUser.role === 'franchise_partner' ? '/portal' : '/dashboard')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoBlock}>
          {/* The lockup already carries the wordmark and tagline, so the separate text would
              repeat them. Both theme variants ship; CSS picks one. */}
          <img className={styles.brandLogoLight} src="/brand/ecosystem-logo.png" alt="Ecosystem" width={260} height={65} />
          <img className={styles.brandLogoDark} src="/brand/ecosystem-logo-dark.png" alt="" aria-hidden="true" width={260} height={65} />
          <span className={styles.tagline}>by Earlyseed Ventures</span>
        </div>

        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.subheading}>Sign in to your workspace</p>

        {authError && (
          <div className={styles.error} role="alert">
            {authError}
          </div>
        )}

        <button className={styles.googleBtn} onClick={handleGoogleSignIn}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className={styles.divider}><span>or continue with email</span></div>

        <form onSubmit={handleEmailSignIn} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@earlyseed.vc"
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {emailError && <p className={styles.formError}>{emailError}</p>}
          <button type="submit" className={styles.submitBtn} disabled={emailLoading}>
            {emailLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.demoSection}>
          <div className={styles.demoDivider}><span>or explore without signing in</span></div>
          {!showPinModal ? (
            <button
              type="button"
              className={styles.demoBtn}
              onClick={() => setShowPinModal(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Try Demo Mode
            </button>
          ) : (
            <form onSubmit={handleDemoEnter} className={styles.pinModal}>
              <p className={styles.pinLabel}>Enter demo PIN</p>
              <input
                className={styles.pinInput}
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
              />
              {pinError && <p className={styles.pinError}>{pinError}</p>}
              <div className={styles.pinActions}>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isPinPending || pin.length !== 4}
                >
                  {isPinPending ? 'Entering…' : 'Enter'}
                </button>
                <button
                  type="button"
                  className={styles.pinCancelBtn}
                  onClick={() => { setShowPinModal(false); setPin(''); setPinError('') }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className={styles.footer}>
          Access is restricted to approved team members only.{' '}
          <a href="/privacy" className={styles.footerLink}>Privacy Policy</a>.
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
