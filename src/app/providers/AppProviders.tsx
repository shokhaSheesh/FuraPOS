import type { ReactNode } from 'react'
import { useLanguage } from '@/shared/i18n'
import { ThemeProvider } from './ThemeProvider'
import { SessionProvider } from './SessionProvider'

export function AppProviders({ children }: { children: ReactNode }) {
  /*
    Everything below is rebuilt when the language changes. Translation happens
    while a screen renders — including in column builders and other plain
    functions — so remounting is what makes a switch take effect everywhere at
    once, rather than threading a hook through every one of them.
  */
  const language = useLanguage()
  return (
    <ThemeProvider>
      <SessionProvider key={language}>{children}</SessionProvider>
    </ThemeProvider>
  )
}
