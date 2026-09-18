import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The interface language. Russian is what the business runs in; English is the
 * source the code is written in, so it needs no dictionary of its own.
 *
 * Adding Uzbek is one more dictionary and one more entry here — nothing else.
 */
export type Language = 'ru' | 'en'

export const LANGUAGES: { value: Language; label: string; name: string }[] = [
  { value: 'ru', label: 'RU', name: 'Русский' },
  { value: 'en', label: 'EN', name: 'English' },
]

interface LanguageState {
  language: Language
  setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ru',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'language' },
  ),
)

/**
 * The current language, readable outside React.
 *
 * Every screen is rebuilt when it changes (see `AppProviders`), so a plain
 * `t()` called during render is always reading the language on screen — which
 * is what lets column builders and other non-component code translate without
 * threading a hook through them.
 */
export const currentLanguage = () => useLanguageStore.getState().language

export const useLanguage = () => useLanguageStore((state) => state.language)
