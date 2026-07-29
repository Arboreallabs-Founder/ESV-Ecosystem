/**
 * Line icons for the investor form's section heads and text inputs.
 *
 * Same stroke language as the app-shell nav (1.6 stroke, round caps, currentColor) so the form
 * doesn't introduce a second icon style — they inherit colour from whatever sits around them.
 */

function Svg({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PersonIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" /></Svg>
)

export const PeopleIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M18 18.72a9.1 9.1 0 0 0 3.74-.78 3 3 0 0 0-4.68-3.32M18 18.72a9.1 9.1 0 0 1-11.96 0M18 18.72V18a5.97 5.97 0 0 0-.94-3.22M6.04 18.72A9.1 9.1 0 0 1 2.3 17.94a3 3 0 0 1 4.68-3.32M6.04 18.72V18c0-1.2.34-2.31.94-3.22M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></Svg>
)

export const TargetIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /></Svg>
)

export const RupeeIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M7 4h10M7 8h10M7 12h4a4 4 0 0 0 0-8M7 12h1l7 8" /></Svg>
)

export const GlobeIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.2 0 4-4 4-9s-1.8-9-4-9-4 4-4 9 1.8 9 4 9ZM3.6 9h16.8M3.6 15h16.8" /></Svg>
)

export const LinkIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M13.19 8.69a4.5 4.5 0 0 1 0 6.36l-3 3a4.5 4.5 0 0 1-6.36-6.36l1.41-1.41m4.57 5.62a4.5 4.5 0 0 1 0-6.36l3-3a4.5 4.5 0 0 1 6.36 6.36l-1.41 1.41" /></Svg>
)

export const CalendarIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M6.75 3v2.25M17.25 3v2.25M3.75 18.75V7.5a2 2 0 0 1 2-2h12.5a2 2 0 0 1 2 2v11.25a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2ZM3.75 9.75h16.5" /></Svg>
)

export const ShieldIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M9 12.75 11.25 15 15 9.75M12 3l7.5 3v5.25c0 4.5-3 8.2-7.5 9.75-4.5-1.55-7.5-5.25-7.5-9.75V6L12 3Z" /></Svg>
)

export const CheckCircleIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></Svg>
)

export const BuildingIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M3.75 21h16.5M4.5 21V4.5a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5V21M13.5 9h4.5a1.5 1.5 0 0 1 1.5 1.5V21M7.5 6.75h3M7.5 10.5h3M7.5 14.25h3M16.5 13.5h.75M16.5 17.25h.75" /></Svg>
)

export const BriefcaseIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M20.25 14.15A48 48 0 0 1 12 15c-2.8 0-5.56-.29-8.25-.85M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6M4.5 6h15a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-11A1.5 1.5 0 0 1 4.5 6Z" /></Svg>
)

export const TagIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M9.57 5.25h-4.5a1.5 1.5 0 0 0-1.5 1.5v4.5c0 .4.16.78.44 1.06l7.5 7.5a1.5 1.5 0 0 0 2.12 0l4.5-4.5a1.5 1.5 0 0 0 0-2.12l-7.5-7.5a1.5 1.5 0 0 0-1.06-.44Zm-2.7 3h.01v.01h-.01V8.25Z" /></Svg>
)

export const HandshakeIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="m12 6.75-2.25 2.25a1.6 1.6 0 0 0 2.25 2.25l1.5-1.5 3.75 3.75M3 8.25l3-2.25h4.5L12 6.75M21 8.25 18 6h-3.75M3 8.25v7.5l3 2.25 2.25-2.25M21 8.25v7.5l-3 2.25-2.25-2.25" /></Svg>
)

export const ChartIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M3 20.25h18M7.5 20.25v-6M12 20.25V8.25M16.5 20.25v-9" /></Svg>
)
