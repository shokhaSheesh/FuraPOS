import { create } from 'zustand'
import type { PaymentMethod, SaleChannel, SaleLine } from '@/features/sales/model/sale'
import { WALK_IN, type TillBuyer } from './buyer'
import { BROWSE_ALL, type TillBrowse } from '../components/TillCatalogueSidebar'

/**
 * One sale being rung up. A cashier serving a queue keeps several open at
 * once (client request) — the man who went to fetch his truck papers, the one
 * at the counter now — each with its own cart, driver and payment.
 */
export interface TillTab {
  id: string
  cart: SaleLine[]
  buyer: TillBuyer
  payment: PaymentMethod
  /** What the cashier typed as received — text, so an empty field stays empty. */
  paidText: string
  promotionId: string | null
  channel: SaleChannel
  comment: string
  /** The parked sale this tab carries on with, when it came from «Отложки». */
  parked: { id: string; number: string } | null
}

let nextId = 1
export const blankTab = (): TillTab => ({
  id: `tab-${nextId++}`,
  cart: [],
  buyer: WALK_IN,
  payment: 'cash',
  paidText: '',
  promotionId: null,
  channel: 'desk',
  comment: '',
  parked: null,
})

/**
 * The till's session: which shop it is standing in, the sales open on it, and
 * where the catalogue is browsing. Held outside the pages so that stepping to
 * «Отложки» or «Касса» and back does not throw away a half-rung sale.
 */
interface TillState {
  locationId: string | null
  tabs: TillTab[]
  activeId: string
  /** The sale just rung up, so it can be opened or its number read out. */
  last: { id: string; number: string } | null
  browse: TillBrowse
  /** Whether the «Каталог запчастей» sidebar is open or folded to a rail. */
  catalogueOpen: boolean
  setBrowse: (browse: TillBrowse) => void
  toggleCatalogue: () => void
  setLocation: (locationId: string) => void
  /** Changes the sale on screen. */
  update: (patch: Partial<Omit<TillTab, 'id'>>) => void
  setCart: (update: (cart: SaleLine[]) => SaleLine[]) => void
  openTab: (tab?: TillTab) => void
  switchTab: (id: string) => void
  closeTab: (id: string) => void
  /** The sale on screen is paid or parked: it leaves the till. */
  finish: (sale: { id: string; number: string } | null) => void
}

const first = blankTab()

export const useTillStore = create<TillState>((set) => ({
  locationId: null,
  tabs: [first],
  activeId: first.id,
  last: null,
  browse: BROWSE_ALL,
  catalogueOpen: true,
  setBrowse: (browse) => set({ browse }),
  toggleCatalogue: () => set((state) => ({ catalogueOpen: !state.catalogueOpen })),
  // Every open cart was checked against the other shelf, so all of them go.
  setLocation: (locationId) => {
    const tab = blankTab()
    set({ locationId, tabs: [tab], activeId: tab.id })
  },
  update: (patch) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === state.activeId ? { ...tab, ...patch } : tab)),
    })),
  setCart: (update) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeId ? { ...tab, cart: update(tab.cart) } : tab,
      ),
    })),
  openTab: (tab = blankTab()) => set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id })),
  switchTab: (id) => set({ activeId: id }),
  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id)
      const rest = state.tabs.filter((tab) => tab.id !== id)
      // There is always a sale to ring up; closing the last leaves a fresh one.
      if (rest.length === 0) {
        const tab = blankTab()
        return { tabs: [tab], activeId: tab.id }
      }
      const activeId =
        state.activeId === id ? rest[Math.min(index, rest.length - 1)]!.id : state.activeId
      return { tabs: rest, activeId }
    }),
  finish: (sale) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === state.activeId)
      const rest = state.tabs.filter((tab) => tab.id !== state.activeId)
      if (rest.length === 0) {
        const tab = blankTab()
        return { tabs: [tab], activeId: tab.id, last: sale ?? state.last }
      }
      return {
        tabs: rest,
        activeId: rest[Math.min(index, rest.length - 1)]!.id,
        last: sale ?? state.last,
      }
    }),
}))

/** The sale on screen. */
export const useActiveTab = () =>
  useTillStore((state) => state.tabs.find((tab) => tab.id === state.activeId) ?? state.tabs[0]!)
