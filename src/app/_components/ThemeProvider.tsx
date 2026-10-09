'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'oled' | 'porcelain' | 'graphite'

/** Themes with a dark background — the logo flips to its light version and the toggle offers the sun. */
export const DARK_THEMES: Theme[] = ['dark', 'oled', 'graphite']
export const isDarkTheme = (t: Theme) => DARK_THEMES.includes(t)

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (theme: Theme) => void }>({
  theme: 'light',
  toggle: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    // Read what the inline script already applied to avoid flicker
    const applied = document.documentElement.getAttribute('data-theme') as Theme | null
    if (applied) setThemeState(applied)
  }, [])

  function apply(next: Theme) {
    setThemeState(next)
    localStorage.setItem('esv-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  // Quick-access toggle (sidebar footer, mobile topbar) stays the Light/Dark sun and moon.
  // OLED, Porcelain and Graphite are chosen in Settings > Appearance; once you're on Porcelain or
  // Graphite the toggle flips between those two, so it doesn't drop you back into Light/Dark.
  function toggle() {
    const next: Record<Theme, Theme> = {
      light: 'dark', dark: 'light', oled: 'light',
      porcelain: 'graphite', graphite: 'porcelain',
    }
    apply(next[theme] ?? 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme: apply }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
