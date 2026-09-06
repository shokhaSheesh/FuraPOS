import type { ReactNode } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { SessionProvider } from './SessionProvider'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  )
}
