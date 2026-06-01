import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = ['/login', '/privacy', '/terms', '/auth']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // Unauthenticated → login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && !isPublicRoute) {
    const { data: publicUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    // Authenticated but not in approved_emails → sign out
    if (!publicUser) {
      return NextResponse.redirect(new URL('/auth/denied', request.url))
    }

    // On login or root → redirect to role home
    if (pathname === '/login' || pathname === '/') {
      const destination =
        publicUser.role === 'franchise_partner' ? '/portal'
        : publicUser.role === 'associate' ? '/pipeline'
        : '/dashboard'
      return NextResponse.redirect(new URL(destination, request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
