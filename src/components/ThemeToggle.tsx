import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Toggle theme">
        <Sun />
      </Button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  function cycleTheme() {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const label =
    theme === 'system'
      ? 'Theme: match system (click for light)'
      : theme === 'dark'
        ? 'Theme: dark (click for system)'
        : 'Theme: light (click for dark)'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
    >
      {theme === 'system' ? (
        <Monitor />
      ) : isDark ? (
        <Moon />
      ) : (
        <Sun />
      )}
    </Button>
  )
}
