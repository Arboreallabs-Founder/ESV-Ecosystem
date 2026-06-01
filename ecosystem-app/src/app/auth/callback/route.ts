import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    const allParams = searchParams.toString()
    return NextResponse.redirect(new URL(`/login?error=no_code&params=${encodeURIComponent(allParams || 'none')}`, origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const msg = encodeURIComponent(error.message)
    return NextResponse.redirect(new URL(`/login?error=oauth&msg=${msg}`, origin))
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=no_session', origin))
  }

  const { data: publicUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!publicUser) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=not_approved', origin))
  }

  const role = publicUser.role
  const destination =
    role === 'franchise_partner' ? '/portal'
    : role === 'associate' ? '/pipeline'
    : '/dashboard'

  return NextResponse.redirect(new URL(destination, origin))
}
