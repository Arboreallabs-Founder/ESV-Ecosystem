'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { WikiSidebarButton } from '@/app/_components/WikiPanel'
import { useTheme } from '@/app/_components/ThemeProvider'
import { switchDemoPersona, exitDemoMode } from '@/app/actions/demo'
import styles from '@/app/app-shell.module.css'

type UserRow = { name: string | null; role: string | null; email: string | null }

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', admin: 'Admin', associate: 'Associate', franchise_partner: 'Partner', super_admin: 'Platform Admin',
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  founder: styles.badgeFounder,
  admin: styles.badgeAdmin,
  associate: styles.badgeAssociate,
  franchise_partner: styles.badgePartner,
}

function Icon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  )
}

type NavItem = { href: string; label: string; roles: string[]; icon: React.ReactNode }
type NavGroup = { group: true; label: string; roles: string[]; icon: React.ReactNode; children: NavItem[] }
type NavEntry = NavItem | NavGroup

const NAV_ITEMS: NavEntry[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    roles: ['founder', 'admin'],
    icon: <Icon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />,
  },
  {
    href: '/pipelines',
    label: 'Pipelines',
    roles: ['founder', 'admin', 'associate'],
    icon: <Icon d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6zM9 6h6M6 9v6M18 9v6" />,
  },
  {
    href: '/forms',
    label: 'Forms',
    roles: ['founder', 'admin', 'associate'],
    icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />,
  },
  {
    href: '/submissions',
    label: 'My Submissions',
    roles: ['franchise_partner'],
    icon: <Icon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2" />,
  },
  {
    group: true,
    label: 'Active Deals',
    roles: ['founder', 'admin', 'associate', 'franchise_partner'],
    icon: <Icon d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    children: [
      {
        href: '/active-deals',
        label: 'Deals',
        roles: ['founder', 'admin', 'associate', 'franchise_partner'],
        icon: <Icon d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />,
      },
      {
        href: '/admin/categories',
        label: 'Categories',
        roles: ['founder', 'admin'],
        icon: <Icon d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3Z" d2="M6 6h.008v.008H6V6Z" />,
      },
    ],
  },
  {
    group: true,
    label: 'Tasks',
    roles: ['founder', 'admin', 'associate'],
    icon: <Icon d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    children: [
      {
        href: '/tasks',
        label: 'Board',
        roles: ['founder', 'admin', 'associate'],
        icon: <Icon d="M9 17V7m0 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10V7m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2" />,
      },
      {
        href: '/tasks/kpi',
        label: 'KPI',
        roles: ['founder', 'admin', 'associate'],
        icon: <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />,
      },
    ],
  },
  {
    href: '/investors',
    label: 'Investors',
    roles: ['founder', 'admin', 'associate', 'franchise_partner'],
    icon: <Icon d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />,
  },
  {
    href: '/admin/partners',
    label: 'Partners',
    roles: ['founder', 'admin'],
    icon: <Icon d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />,
  },
  {
    href: '/admin/users',
    label: 'Admin',
    roles: ['founder', 'admin'],
    icon: <Icon
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
      d2="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />,
  },
  {
    href: '/portal',
    label: 'My Links',
    roles: ['franchise_partner'],
    icon: <Icon d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />,
  },
]

const DEMO_PERSONAS = [
  { value: 'founder', label: 'Founder' },
  { value: 'admin', label: 'Admin' },
  { value: 'associate', label: 'Associate' },
  { value: 'franchise_partner', label: 'Partner' },
]

export default function AppShell({
  user,
  children,
  fullWidth = false,
  demoMode = false,
  demoPersona = 'founder',
}: {
  user: UserRow
  children: React.ReactNode
  fullWidth?: boolean
  demoMode?: boolean
  demoPersona?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle: toggleTheme } = useTheme()
  const [isPersonaSwitching, startPersonaTransition] = useTransition()
  const role = demoMode ? demoPersona : (user.role ?? 'associate')
  const displayName = user.name ?? user.email ?? 'User'
  const initials = displayName.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const [flyoutTop, setFlyoutTop] = useState<number | null>(null)
  const hideTimer = useState<ReturnType<typeof setTimeout> | null>(null)

  function handleGroupEnter(e: React.MouseEvent<HTMLDivElement>) {
    if (hideTimer[0]) clearTimeout(hideTimer[0])
    const rect = e.currentTarget.getBoundingClientRect()
    setFlyoutTop(rect.top)
  }

  function handleGroupLeave() {
    hideTimer[1](setTimeout(() => setFlyoutTop(null), 180))
  }

  function handleFlyoutEnter() {
    if (hideTimer[0]) clearTimeout(hideTimer[0])
  }

  function handleFlyoutLeave() {
    hideTimer[1](setTimeout(() => setFlyoutTop(null), 80))
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handlePersonaSwitch(persona: string) {
    startPersonaTransition(async () => {
      await switchDemoPersona(persona)
      if (persona === 'franchise_partner') {
        router.push('/submissions')
      } else if (demoPersona === 'franchise_partner') {
        router.push('/dashboard')
      } else {
        router.refresh()
      }
    })
  }

  async function handleExitDemo() {
    await exitDemoMode()
    router.push('/login')
  }

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        {/* Demo mode banner */}
        {demoMode && (
          <div className={styles.demoBanner}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            Demo Mode
          </div>
        )}

        {/* Logo / workspace */}
        <div className={styles.sidebarTop}>
          <div className={styles.workspace}>
            <div className={styles.logoMark}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M7.5 1L13 4.25V11.25L7.5 14.5L2 11.25V4.25L7.5 1Z" fill="white" opacity="0.95" />
              </svg>
            </div>
            <span className={styles.logoText}>Ecosystem</span>
          </div>
          <div className={styles.workspaceSub}>{demoMode ? 'AA Labs — Demo' : 'Earlyseed Ventures'}</div>
        </div>

        {/* Nav links */}
        <nav className={styles.sidebarNav}>
          {visibleNav.map((entry) => {
            if ('group' in entry) {
              const visibleChildren = entry.children.filter((c) => c.roles.includes(role))
              if (visibleChildren.length === 0) return null
              const isGroupActive = entry.children.some((c) => pathname === c.href || pathname.startsWith(c.href))
              return (
                <div key={entry.label} className={styles.navGroupWrapper} onMouseEnter={handleGroupEnter} onMouseLeave={handleGroupLeave}>
                  <div className={`${styles.navGroupBtn} ${isGroupActive ? styles.navGroupBtnActive : ''}`}>
                    <span className={styles.navIcon}>{entry.icon}</span>
                    {entry.label}
                    <svg
                      className={styles.navGroupChevron}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                  {flyoutTop !== null && (
                    <div
                      className={styles.navFlyout}
                      style={{ top: flyoutTop }}
                      onMouseEnter={handleFlyoutEnter}
                      onMouseLeave={handleFlyoutLeave}
                    >
                      <div className={styles.navFlyoutLabel}>{entry.label}</div>
                      {visibleChildren.map((child) => {
                        const isActive = pathname === child.href || pathname.startsWith(child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`${styles.navSubItem} ${isActive ? styles.navSubItemActive : ''}`}
                          >
                            <span className={styles.navIcon}>{child.icon}</span>
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
            const isActive =
              pathname === entry.href ||
              (entry.href !== '/dashboard' && entry.href !== '/portal' && entry.href !== '/submissions' && pathname.startsWith(entry.href))
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}>{entry.icon}</span>
                {entry.label}
              </Link>
            )
          })}
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <WikiSidebarButton />
            <Link href="/wiki" className={styles.navItem} style={{ marginTop: '0.125rem' }}>
              <span className={styles.navIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </span>
              Full Wiki
            </Link>
          </div>
        </nav>

        {/* Demo persona switcher */}
        {demoMode && (
          <div className={styles.personaSwitcher}>
            <div className={styles.personaLabel}>Viewing as</div>
            <div className={styles.personaRow}>
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.value}
                  className={`${styles.personaBtn} ${demoPersona === p.value ? styles.personaBtnActive : ''}`}
                  onClick={() => handlePersonaSwitch(p.value)}
                  disabled={isPersonaSwitching}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button className={styles.exitDemoBtn} onClick={handleExitDemo}>
              ← Exit Demo
            </button>
          </div>
        )}

        {/* User footer */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userRow}>
            <div className={styles.userAvatar}>{initials}</div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{displayName}</div>
              <div className={`${styles.roleBadge} ${ROLE_BADGE_CLASS[role] ?? styles.badgeAssociate}`}>
                {ROLE_LABELS[role] ?? role}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/settings" className={styles.signOutBtn} style={{ flex: 1, textAlign: 'center' }}>
              Settings
            </Link>
            <button
              className={styles.signOutBtn}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 36, padding: 0, flexShrink: 0, fontSize: '1rem' }}
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      <main className={fullWidth ? styles.mainFull : styles.main}>
        {children}
      </main>
    </div>
  )
}
