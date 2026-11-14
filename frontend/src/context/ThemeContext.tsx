import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('upward_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return 'dark' // Default to deep black institutional theme
  })

  useEffect(() => {
    localStorage.setItem('upward_theme', theme)
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      document.body.style.backgroundColor = '#090d14'
      document.body.style.color = '#f8fafc'
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
      document.body.style.backgroundColor = '#f8fafc'
      document.body.style.color = '#0f172a'
    }
  }, [theme])

  function toggleTheme() {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
