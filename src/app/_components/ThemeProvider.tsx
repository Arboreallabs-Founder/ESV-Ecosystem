'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'oled'

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

  // Quick-access toggle (sidebar footer, mobile topbar) stays a simple light/dark cycle —
  // OLED is reachable only from Settings > Appearance, not this shortcut.
  function toggle() {
    apply(theme === 'light' ? 'dark' : 'light')
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
