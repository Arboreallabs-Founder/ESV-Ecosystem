'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const DEMO_PIN = '1551'
const DEMO_EMAIL = 'demo@aalabs-demo.com'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'AA-Labs-Demo-2026!'

export async function verifyPinAndLogin(pin: string) {
  if (pin !== DEMO_PIN) throw new Error('Incorrect PIN')
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  if (error) throw new Error('Demo login failed. Please try again.')
  const store = await cookies()
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
