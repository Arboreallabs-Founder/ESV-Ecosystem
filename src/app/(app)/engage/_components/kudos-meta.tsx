import type { KudosCategory } from '@/lib/types'

/* Per-category art direction for the kudos card. These cards are deliberately theme-independent
   — always the rich indigo/violet treatment regardless of light/dark/OLED — because a kudos is a
   celebratory artifact, like a physical greeting card, not another app surface. */

export type KudosArt = {
  label: string
  tagline: string
  /** Background gradient for the card face. */
  gradient: string
  /** Accent used by the medallion glow and divider. */
  accent: string
  icon: React.ReactNode
}

/* ── Illustrated icons ──────────────────────────────────────────────────
   Drawn as inline SVG with gradient fills so they read as soft 3D shapes rather than flat
   line icons, matching the reference art. Each is authored on a 120×120 canvas. */

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-violet`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#B9A6FF" />
        <stop offset="100%" stopColor="#7C5CF0" />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFD98A" />
        <stop offset="100%" stopColor="#F0A93B" />
      </linearGradient>
      <linearGradient id={`${id}-teal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9BE6DC" />
        <stop offset="100%" stopColor="#4FC4B4" />
      </linearGradient>
      <linearGradient id={`${id}-pale`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#C9BEFF" />
      </linearGradient>
    </defs>
  )
}

function StarBurst() {
  const id = 'kb'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <Defs id={id} />
      {[...Array(12)].map((_, i) => (
        <rect
          key={i}
          x="57.5" y="8" width="5" height="17" rx="2.5"
          fill={i % 3 === 0 ? `url(#${id}-gold)` : `url(#${id}-violet)`}
          transform={`rotate(${i * 30} 60 60)`}
        />
      ))}
      <path
        d="M60 34l7.6 15.4 17 2.5-12.3 12 2.9 16.9L60 72.8 44.8 80.8l2.9-16.9-12.3-12 17-2.5z"
        fill={`url(#${id}-gold)`}
      />
    </svg>
  )
}

function TeamworkIcon() {
  const id = 'kt'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <Defs id={id} />
      <path d="M32 46a30 30 0 0 1 56 0" stroke={`url(#${id}-violet)`} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M36 88a30 30 0 0 0 48 0" stroke={`url(#${id}-teal)`} strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="60" cy="24" r="11" fill={`url(#${id}-violet)`} />
      <path d="M42 48a18 18 0 0 1 36 0z" fill={`url(#${id}-violet)`} />
      <circle cx="26" cy="72" r="10" fill={`url(#${id}-teal)`} />
      <path d="M10 94a16 16 0 0 1 32 0z" fill={`url(#${id}-teal)`} />
      <circle cx="94" cy="72" r="10" fill={`url(#${id}-gold)`} />
      <path d="M78 94a16 16 0 0 1 32 0z" fill={`url(#${id}-gold)`} />
      <path d="M60 56c4-6 14-4 14 4 0 7-9 12-14 16-5-4-14-9-14-16 0-8 10-10 14-4z" fill={`url(#${id}-pale)`} />
    </svg>
  )
}

function LeadershipIcon() {
  const id = 'kl'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <Defs id={id} />
      <path d="M22 96V26" stroke={`url(#${id}-violet)`} strokeWidth="8" strokeLinecap="round" />
      <path d="M28 28h56l-12 18 12 18H28z" fill={`url(#${id}-gold)`} />
      <circle cx="86" cy="84" r="8" fill={`url(#${id}-teal)`} />
      <circle cx="66" cy="94" r="6" fill={`url(#${id}-violet)`} />
      <circle cx="102" cy="98" r="5" fill={`url(#${id}-pale)`} />
    </svg>
  )
}

function InnovationIcon() {
  const id = 'ki'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <Defs id={id} />
      <ellipse cx="60" cy="62" rx="44" ry="18" stroke={`url(#${id}-violet)`} strokeWidth="3" fill="none" transform="rotate(-24 60 62)" />
      <ellipse cx="60" cy="62" rx="44" ry="18" stroke={`url(#${id}-violet)`} strokeWidth="3" fill="none" transform="rotate(24 60 62)" />
      <path d="M60 22a24 24 0 0 1 14 43.4V76H46V65.4A24 24 0 0 1 60 22z" fill={`url(#${id}-violet)`} opacity="0.92" />
      <path d="M52 66c2-8 14-8 16 0" stroke={`url(#${id}-gold)`} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <rect x="48" y="80" width="24" height="6" rx="3" fill={`url(#${id}-pale)`} />
      <rect x="51" y="90" width="18" height="6" rx="3" fill={`url(#${id}-pale)`} opacity="0.75" />
      <circle cx="17" cy="52" r="7" fill={`url(#${id}-teal)`} />
      <circle cx="103" cy="52" r="7" fill={`url(#${id}-violet)`} />
      <circle cx="30" cy="92" r="6" fill={`url(#${id}-teal)`} />
      <circle cx="92" cy="92" r="6" fill={`url(#${id}-gold)`} />
    </svg>
  )
}

function AboveBeyondIcon() {
  const id = 'ka'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <Defs id={id} />
      <path d="M6 104l30-34 22 16 26-40" stroke={`url(#${id}-violet)`} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <path d="M74 40l10-18 10 18-10 8z" fill={`url(#${id}-violet)`} opacity="0.5" />
      <path d="M88 12l5.6 11.4 12.6 1.8-9.1 8.9 2.2 12.5L88 40.7 76.7 46.6l2.2-12.5-9.1-8.9 12.6-1.8z" fill={`url(#${id}-gold)`} />
      <path d="M46 78h28v8a14 14 0 0 1-28 0z" fill={`url(#${id}-teal)`} />
      <rect x="52" y="98" width="16" height="6" rx="3" fill={`url(#${id}-pale)`} />
      <rect x="44" y="104" width="32" height="7" rx="3.5" fill={`url(#${id}-violet)`} />
      <path d="M46 78h-6a8 8 0 0 0 8 8M74 78h6a8 8 0 0 1-8 8" stroke={`url(#${id}-teal)`} strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function CustomerFocusIcon() {
  const id = 'kc'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <Defs id={id} />
      <circle cx="60" cy="24" r="11" fill={`url(#${id}-violet)`} />
      <path d="M43 48a17 17 0 0 1 34 0z" fill={`url(#${id}-violet)`} />
      <rect x="6" y="40" width="30" height="22" rx="11" fill={`url(#${id}-teal)`} />
      <path d="M16 62l-2 8 9-6z" fill={`url(#${id}-teal)`} />
      <rect x="84" y="40" width="30" height="22" rx="11" fill={`url(#${id}-gold)`} />
      <path d="M104 62l2 8-9-6z" fill={`url(#${id}-gold)`} />
      <path d="M60 58c4-6 14-4 14 4 0 7-9 12-14 16-5-4-14-9-14-16 0-8 10-10 14-4z" fill={`url(#${id}-pale)`} />
      <rect x="14" y="86" width="24" height="20" rx="5" fill={`url(#${id}-teal)`} />
      <rect x="82" y="86" width="24" height="20" rx="5" fill={`url(#${id}-gold)`} />
      <path d="M38 96c8-4 16-4 24 0 6 3 10 6 16 4" stroke={`url(#${id}-pale)`} strokeWidth="9" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function OtherIcon() {
  const id = 'ko'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <Defs id={id} />
      <path d="M60 30c4 14 8 18 22 22-14 4-18 8-22 22-4-14-8-18-22-22 14-4 18-8 22-22z" fill={`url(#${id}-violet)`} />
      <circle cx="26" cy="40" r="10" fill={`url(#${id}-violet)`} opacity="0.85" />
      <rect x="82" y="28" width="22" height="22" rx="6" fill="#5B9DF9" transform="rotate(45 93 39)" />
      <path d="M20 84l16-10v20z" fill={`url(#${id}-gold)`} />
      <path d="M96 74l10 7-4 12H90l-4-12z" fill={`url(#${id}-teal)`} />
      <circle cx="60" cy="96" r="10" fill={`url(#${id}-gold)`} />
      <rect x="58" y="6" width="4" height="14" rx="2" fill={`url(#${id}-pale)`} />
    </svg>
  )
}

/* Art for a kudos with no category selected. */
export const KUDOS_ART_DEFAULT: KudosArt = {
  label: 'Kudos',
  tagline: 'Recognition for every great contribution',
  gradient: 'linear-gradient(135deg, #241E56 0%, #2E2270 48%, #5B37B8 100%)',
  accent: '#B9A6FF',
  icon: <StarBurst />,
}

export const KUDOS_ART: Record<KudosCategory, KudosArt> = {
  Teamwork: {
    label: 'Teamwork',
    tagline: 'Celebrating collaboration and support',
    gradient: 'linear-gradient(135deg, #241E56 0%, #33257A 48%, #6B3FC4 100%)',
    accent: '#9BE6DC',
    icon: <TeamworkIcon />,
  },
  Leadership: {
    label: 'Leadership',
    tagline: 'Guiding and lifting the team forward',
    gradient: 'linear-gradient(135deg, #1F1B4D 0%, #3A2472 48%, #7A3FB0 100%)',
    accent: '#FFD98A',
    icon: <LeadershipIcon />,
  },
  Innovation: {
    label: 'Innovation',
    tagline: 'Celebrating bold ideas and creative thinking',
    gradient: 'linear-gradient(135deg, #201A52 0%, #2B2478 48%, #6339C8 100%)',
    accent: '#B9A6FF',
    icon: <InnovationIcon />,
  },
  'Above & Beyond': {
    label: 'Above & Beyond',
    tagline: 'Celebrating exceptional effort and initiative',
    gradient: 'linear-gradient(135deg, #1D1A4E 0%, #2F2472 48%, #6A3EC0 100%)',
    accent: '#FFD98A',
    icon: <AboveBeyondIcon />,
  },
  'Customer Focus': {
    label: 'Customer Focus',
    tagline: 'Celebrating outstanding care for customers',
    gradient: 'linear-gradient(135deg, #221C58 0%, #2C2478 48%, #5E39C0 100%)',
    accent: '#9BE6DC',
    icon: <CustomerFocusIcon />,
  },
  Other: {
    label: 'Other',
    tagline: 'Celebrating unique contributions',
    gradient: 'linear-gradient(135deg, #231D57 0%, #302577 48%, #6540C6 100%)',
    accent: '#B9A6FF',
    icon: <OtherIcon />,
  },
}

export function artFor(category: KudosCategory | null): KudosArt {
  return category ? KUDOS_ART[category] ?? KUDOS_ART_DEFAULT : KUDOS_ART_DEFAULT
}
