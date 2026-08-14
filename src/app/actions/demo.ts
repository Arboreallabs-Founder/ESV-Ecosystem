'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * Demo login.
 *
 * The PIN, the account and a fallback password used to be constants in this file. That made a
 * four-digit number in source control sufficient to obtain a session as a *founder* of the demo
 * organisation — and a founder could then set their own role to super_admin, which bypasses org
 * scoping across the whole RLS estate, in a project that also holds the real tenant. The database
 * half of that chain is closed in 20260920; this is the half in front of it.
 *
 * Everything now comes from the environment and there is no fallback: with nothing configured the
 * action refuses rather than falling back to something guessable. Fail closed, because the failure
 * mode of the alternative is an authenticated stranger.
 */
const DEMO_ENABLED = process.env.DEMO_LOGIN_ENABLED === 'true'
const DEMO_PIN = process.env.DEMO_PIN
const DEMO_EMAIL = process.env.DEMO_EMAIL
const DEMO_PASSWORD = process.env.DEMO_PASSWORD

/**
 * A four-digit PIN is 10,000 guesses — minutes of scripted attempts. This raises the cost without
 * pretending to be a rate limiter: module state is per server instance, so it resets on cold start
 * and is not shared between them. It is a speed bump on a door that should mainly be locked by
 * DEMO_LOGIN_ENABLED being unset in production. A real limit belongs at the edge.
 */
const attempts = new Map<string, { count: number; first: number }>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8

function tooManyAttempts(key: string): boolean {
  const now = Date.now()
  const rec = attempts.get(key)
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now })
    return false
  }
  rec.count += 1
  return rec.count > MAX_ATTEMPTS
}

export async function verifyPinAndLogin(pin: string) {
  if (!DEMO_ENABLED || !DEMO_PIN || !DEMO_EMAIL || !DEMO_PASSWORD) {
    throw new Error('Demo access is not available.')
  }

  const store = await cookies()
  // No IP is available to a Server Action without reading headers; the forwarded address is the
  // best key on Vercel and falls back to a single shared bucket, which throttles everyone together
  // rather than nobody.
  const { headers } = await import('next/headers')
  const h = await headers()
  const key = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'shared'
  if (tooManyAttempts(key)) {
    throw new Error('Too many attempts. Try again later.')
  }

  if (pin !== DEMO_PIN) throw new Error('Incorrect PIN')
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  if (error) throw new Error('Demo login failed. Please try again.')
  store.set('demo_mode', '1', { path: '/', httpOnly: false, sameSite: 'lax' })
  store.set('demo_persona', 'founder', { path: '/', httpOnly: false, sameSite: 'lax' })
}

export async function switchDemoPersona(persona: string) {
  const store = await cookies()
  store.set('demo_persona', persona, { path: '/', httpOnly: false, sameSite: 'lax' })
}

export async function exitDemoMode() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const store = await cookies()
  store.delete('demo_mode')
  store.delete('demo_persona')
}
