import type { LeaveType } from '@/lib/types'

/* Icon + code per leave type — deliberately NOT hue-coded.
   The app's muted palette cannot carry four distinguishable categorical hues: its two warm
   tokens (accent #D5AE8F, warning #CB8C7C) measure ΔE 8.7 in *normal* vision — below the 15
   floor, so even full-colour-vision users can't reliably separate them — and both fall under the
   chroma floor, i.e. they read as gray. Rather than invent off-brand saturated hues, identity
   here rides on channels that actually work: a distinct icon and a two-letter code per type.
   Colour is reserved for meaning, not category — the only coloured state is a depleted balance. */

export type LeaveTypeArt = {
  code: string
  label: string
  icon: React.ReactNode
}

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8v4l3 2" />
      <path d="M3.05 11a9 9 0 1 1 .5 4" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}

export const LEAVE_TYPE_ART: Record<string, LeaveTypeArt> = {
  earned: { code: 'EL', label: 'Earned Leave', icon: <LeafIcon /> },
  sick: { code: 'SL', label: 'Sick Leave', icon: <HeartIcon /> },
  my_day: { code: 'MD', label: 'My Day', icon: <SunIcon /> },
  compensatory: { code: 'CL', label: 'Compensatory Leave', icon: <ClockIcon /> },
  // Not leave in the HR sense — someone working from home is working — but it's requested,
  // approved and counted against an annual allowance identically, so it lives here.
  wfh: { code: 'WFH', label: 'Work from Home', icon: <HouseIcon /> },
}

export function artForLeaveType(type: LeaveType | string): LeaveTypeArt {
  return LEAVE_TYPE_ART[type] ?? { code: '—', label: String(type), icon: null }
}

/** Half-day aware formatting — 12 not 12.0, but 12.5 stays 12.5. */
export function fmtDays(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}
