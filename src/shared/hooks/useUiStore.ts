import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Which sidebar sections are expanded, by section id. */
  openSections: string[]
  toggleSection: (id: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      openSections: ['sales', 'catalog'],
      toggleSection: (id) =>
        set((state) => ({
          openSections: state.openSections.includes(id)
            ? state.openSections.filter((section) => section !== id)
            : [...state.openSections, id],
        })),
    }),
    { name: 'ui' },
  ),
)
