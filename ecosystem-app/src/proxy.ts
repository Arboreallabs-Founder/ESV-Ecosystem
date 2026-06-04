import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = ['/login', '/privacy', '/terms', '/auth', '/f/']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getSession() reads the cookie without a network round-trip (~1ms).
  // Page-level code calls getUser() for authoritative validation.
  const { data: { session } } = await supabase.auth.getSession()
  const pathname = request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // For root and login redirects, do a lightweight role lookup only when necessary.
  if (session && (pathname === '/login' || pathname === '/')) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!userRow) {
      return NextResponse.redirect(new URL('/auth/denied', request.url))
    }

    const destination =
      userRow.role === 'franchise_partner' ? '/portal'
      : userRow.role === 'associate' ? '/pipelines'
      : '/dashboard'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
