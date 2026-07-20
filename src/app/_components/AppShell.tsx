'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
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

function Icon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  )
}

type NavItem = { href: string; label: string; roles: string[]; icon: React.ReactNode; section?: string }
type NavGroup = { group: true; label: string; roles: string[]; icon: React.ReactNode; children: NavItem[]; section?: string }
type NavEntry = NavItem | NavGroup

const NAV_ITEMS: NavEntry[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    roles: ['founder', 'admin'],
    icon: <Icon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />,
  },
  {
    href: '/deal-desk',
    label: 'Deal Desk',
    roles: ['founder', 'admin', 'associate'],
    section: 'Deal Flow',
    icon: <Icon d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />,
  },
  {
    href: '/pipelines',
    label: 'Pipelines',
    roles: ['founder', 'admin', 'associate'],
    section: 'Deal Flow',
    icon: <Icon d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6zM9 6h6M6 9v6M18 9v6" />,
  },
  {
    href: '/forms',
    label: 'Forms',
    roles: ['founder', 'admin', 'associate'],
    section: 'Deal Flow',
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
    section: 'Deal Flow',
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
    section: 'Team',
    icon: <Icon d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    children: [
      {
        href: '/tasks',
        label: 'Board',
        roles: ['founder', 'admin', 'associate'],
        icon: <Icon d="M9 17V7m0 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10V7m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2" />,
      },
      {
        href: '/my-todos',
        label: 'My To-Dos',
        roles: ['founder', 'admin', 'associate'],
        icon: <Icon d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
      },
      {
        href: '/tasks/recurring',
        label: 'Recurring',
        roles: ['founder', 'admin', 'associate'],
        icon: <Icon d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />,
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
    href: '/escalations',
    label: 'Escalations',
    roles: ['founder', 'admin', 'associate', 'franchise_partner'],
    section: 'Team',
    icon: <Icon d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />,
  },
  {
    group: true,
    label: 'Bulletin Board',
    roles: ['founder', 'admin', 'associate'],
    section: 'Team',
    icon: <Icon d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.65a25.05 25.05 0 0 1 4.66-.594m-4.66.594a20.7 20.7 0 0 1-1.62-.463m6.28-4.03a2.25 2.25 0 0 0 0-4.5m0 4.5v-4.5m0 4.5a25.05 25.05 0 0 1-4.66.594m4.66-5.094a25.05 25.05 0 0 0-4.66-.594m0 0V5.85m0 .001v3.9m0-3.9a2.25 2.25 0 0 0-4.66-.001" />,
    children: [
      {
        href: '/bulletin',
        label: 'Board',
        roles: ['founder', 'admin', 'associate'],
        icon: <Icon d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.65a25.05 25.05 0 0 1 4.66-.594m-4.66.594a20.7 20.7 0 0 1-1.62-.463m6.28-4.03a2.25 2.25 0 0 0 0-4.5m0 4.5v-4.5m0 4.5a25.05 25.05 0 0 1-4.66.594m4.66-5.094a25.05 25.05 0 0 0-4.66-.594m0 0V5.85m0 .001v3.9m0-3.9a2.25 2.25 0 0 0-4.66-.001" />,
      },
      {
        href: '/bulletin/kpi',
        label: 'KPI',
        roles: ['founder', 'admin', 'associate'],
        icon: <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />,
      },
    ],
  },
  {
    href: '/hr',
    label: 'HR Zone',
    roles: ['founder', 'admin', 'associate'],
    section: 'Team',
    icon: <Icon d="M12 4.5v15m7.5-7.5h-15" d2="M3.75 20.25h16.5a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5Z" />,
  },
  {
    href: '/companies',
    label: 'Companies',
    roles: ['founder', 'admin', 'associate'],
    section: 'Database',
    icon: <Icon d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />,
  },
  {
    href: '/investors',
    label: 'Investors',
    roles: ['founder', 'admin', 'associate', 'franchise_partner'],
    section: 'Database',
    icon: <Icon d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />,
  },
  {
    href: '/earnings',
    label: 'My Earnings',
    roles: ['franchise_partner'],
    icon: <Icon d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  },
  {
    href: '/admin/partners',
    label: 'Partners',
    roles: ['founder', 'admin'],
    section: 'Database',
    icon: <Icon d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />,
  },
  {
    href: '/admin/users',
    label: 'Admin',
    roles: ['founder', 'admin'],
    section: 'Admin',
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

// One icon per nav section header (Deal Flow / Team / Database / Admin).
const SECTION_ICONS: Record<string, React.ReactNode> = {
  'Deal Flow': <Icon d="M3.75 13.5 10.5 3v7.5h6l-6.75 10.5v-7.5h-6Z" />,
  Team: <Icon d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />,
  Database: <Icon d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />,
  Admin: <Icon
    d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
    d2="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
  />,
}

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

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false) }, [pathname])

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function toggleSection(label: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
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
  // Section labels (Deal Flow / Team / Database / Admin) are a founder/admin/associate affordance —
  // the partner nav is short enough that grouping it would just add clutter.
  const showSections = role !== 'franchise_partner'
  const navRows = visibleNav.map((entry) => ({ entry, section: showSections ? entry.section : undefined }))

  function entryHrefs(entry: NavEntry): string[] {
    return 'group' in entry ? entry.children.map((c) => c.href) : [entry.href]
  }
  function isEntryActive(entry: NavEntry): boolean {
    return entryHrefs(entry).some((h) => pathname === h || pathname.startsWith(`${h}/`))
  }
  // A section auto-expands (even if collapsed) while it holds the active route.
  const activeSections = new Set(
    navRows.filter((r) => r.section && isEntryActive(r.entry)).map((r) => r.section as string),
  )

  return (
    <div className={styles.shell}>
      {mobileOpen && <div className={styles.backdrop} onClick={() => setMobileOpen(false)} />}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        {/* Demo mode banner */}
        {demoMode && (
          <div className={styles.demoBanner}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            Demo Mode
          </div>
        )}

        {/* Workspace header */}
        <div className={styles.sidebarTop}>
          <Link href="/settings" className={styles.workspace} onClick={() => setMobileOpen(false)}>
            <div className={styles.logoMark}>
              <img src="/ecosystem-favicon-sapling.png" alt="" width={36} height={36} />
            </div>
            <div className={styles.workspaceText}>
              <span className={styles.logoText}>Ecosystem</span>
              <span className={styles.workspaceSub}>{demoMode ? 'AA Labs — Demo' : 'Earlyseed Ventures'}</span>
            </div>
            <svg className={styles.workspaceChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        {/* Nav links */}
        <nav className={styles.sidebarNav}>
          {navRows.map(({ entry, section }, i) => {
            const isSectionStart = !!section && navRows[i - 1]?.section !== section
            const sectionOpen = !section || !collapsedSections.has(section) || activeSections.has(section)
            // Non-header rows of a collapsed section are skipped entirely.
            if (section && !isSectionStart && !sectionOpen) return null

            const header = isSectionStart && (
              <button
                type="button"
                className={styles.navSection}
                onClick={() => toggleSection(section as string)}
                aria-expanded={sectionOpen}
              >
                <span className={styles.navSectionIcon}>{SECTION_ICONS[section as string]}</span>
                <span className={styles.navSectionText}>{section}</span>
                <svg
                  className={`${styles.navSectionChevron} ${sectionOpen ? styles.navSectionChevronOpen : ''}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            )
            // Collapsed section: render only its header, not the entry itself.
            if (section && isSectionStart && !sectionOpen) {
              return <Fragment key={'group' in entry ? entry.label : entry.href}>{header}</Fragment>
            }

            if ('group' in entry) {
              const visibleChildren = entry.children.filter((c) => c.roles.includes(role))
              if (visibleChildren.length === 0) return null
              // Longest-matching child is "active" so /tasks vs /tasks/kpi don't both highlight.
              const activeChildHref = visibleChildren
                .map((c) => c.href)
                .filter((h) => pathname === h || pathname.startsWith(h + '/'))
                .sort((a, b) => b.length - a.length)[0] ?? null
              // Open if toggled open, or auto-open because it holds the active route.
              const open = openGroups.has(entry.label) || activeChildHref !== null
              return (
                <Fragment key={entry.label}>
                  {header}
                  <div className={styles.navGroupWrapper}>
                    <Link
                      href={visibleChildren[0].href}
                      className={`${styles.navGroupBtn} ${activeChildHref ? styles.navGroupBtnActive : ''}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className={styles.navIcon}>{entry.icon}</span>
                      <span className={styles.navLabel}>{entry.label}</span>
                    </Link>
                    <button
                      type="button"
                      className={styles.navGroupChevronBtn}
                      onClick={() => toggleGroup(entry.label)}
                      aria-expanded={open}
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${entry.label}`}
                    >
                      <svg
                        className={`${styles.navGroupChevron} ${open ? styles.navGroupChevronOpen : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className={styles.navAccordion}>
                        {visibleChildren.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`${styles.navSubItem} ${child.href === activeChildHref ? styles.navSubItemActive : ''}`}
                            onClick={() => setMobileOpen(false)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            }
            const isActive =
              pathname === entry.href ||
              (entry.href !== '/dashboard' && entry.href !== '/portal' && entry.href !== '/submissions' && pathname.startsWith(entry.href))
            return (
              <Fragment key={entry.href}>
                {header}
                <Link
                  href={entry.href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className={styles.navIcon}>{entry.icon}</span>
                  <span className={styles.navLabel}>{entry.label}</span>
                </Link>
              </Fragment>
            )
          })}
          <div className={styles.sidebarHelp}>
            <WikiSidebarButton />
            <Link href="/wiki" className={styles.navItem} onClick={() => setMobileOpen(false)}>
              <span className={styles.navIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </span>
              <span className={styles.navLabel}>Full Wiki</span>
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
          <Link href="/settings" className={styles.userRow} onClick={() => setMobileOpen(false)}>
            <div className={styles.userAvatar}>{initials}</div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userEmail}>{user.email ?? ROLE_LABELS[role] ?? role}</div>
            </div>
            <svg className={styles.userChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
          <div className={styles.footerControls}>
            <button className={styles.signOutBtn} onClick={handleSignOut} style={{ flex: 1 }}>Sign out</button>
            <button
              className={styles.signOutBtn}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 36, padding: 0, flexShrink: 0, fontSize: '1rem' }}
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.contentCol}>
        {/* Mobile top bar — hidden on desktop via CSS */}
        <header className={styles.topbar}>
          <button className={styles.hamburger} onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className={styles.topbarBrand}>
            <div className={styles.logoMark}>
              <img src="/ecosystem-favicon-sapling.png" alt="" width={28} height={28} />
            </div>
            <span className={styles.logoText}>Ecosystem</span>
          </div>
          <button
            className={styles.topbarTheme}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </header>
        <main className={fullWidth ? styles.mainFull : styles.main}>
          {children}
        </main>
      </div>
    </div>
  )
}
