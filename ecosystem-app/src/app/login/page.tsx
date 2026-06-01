'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
          <div className={styles.logoMark}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <path d="M13 2L22 7.5V18.5L13 24L4 18.5V7.5L13 2Z" fill="white" opacity="0.95" />
            </svg>
          </div>
          <span className={styles.wordmark}>Ecosystem</span>
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
