'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : authError.message
      )
      setLoading(false)
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user?.id)
      .single()

    const role = userData?.role ?? 'associate'

    if (role === 'franchise_partner') {
      router.push('/portal')
    } else if (role === 'associate') {
      router.push('/pipeline')
    } else {
      router.push('/dashboard')
    }

    router.refresh()
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoBlock}>
          <div className={styles.logoMark}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <path
                d="M13 2L22 7.5V18.5L13 24L4 18.5V7.5L13 2Z"
                fill="white"
                opacity="0.95"
              />
            </svg>
          </div>
          <span className={styles.wordmark}>Ecosystem</span>
          <span className={styles.tagline}>by Earlyseed Ventures</span>
        </div>

        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.subheading}>Sign in to your workspace</p>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="you@earlyseed.vc"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.footer}>
          By signing in you agree to our{' '}
          <a href="/privacy" className={styles.footerLink}>
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </div>
  )
}
