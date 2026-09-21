import { create } from 'zustand'
import type { SaleLine } from '@/features/sales/model/sale'
import { WALK_IN, type TillBuyer } from './buyer'
import { BROWSE_ALL, type TillBrowse } from '../components/TillCatalogueSidebar'

/**
 * The till's session: which shop it is standing in, what is in the cart, and
 * who is buying. Held outside the pages so that stepping from «Продажа» to
 * «Касса» to record an expense and back does not throw away a half-rung sale.
 */
interface TillState {
  locationId: string | null
  cart: SaleLine[]
  buyer: TillBuyer
  /** The sale just rung up, so it can be opened or its number read out. */
  last: { id: string; number: string } | null
  /** Where the catalogue sidebar has narrowed the shelf to. */
  browse: TillBrowse
  setBrowse: (browse: TillBrowse) => void
  setLocation: (locationId: string) => void
  setCart: (update: SaleLine[] | ((cart: SaleLine[]) => SaleLine[])) => void
  setBuyer: (buyer: TillBuyer) => void
  finish: (sale: { id: string; number: string }) => void
  clear: () => void
}

export const useTillStore = create<TillState>((set) => ({
  locationId: null,
  cart: [],
  buyer: WALK_IN,
  last: null,
  browse: BROWSE_ALL,
  setBrowse: (browse) => set({ browse }),
  // What is in the cart was checked against the other shelf, so it goes.
  setLocation: (locationId) => set({ locationId, cart: [] }),
  setCart: (update) =>
    set((state) => ({ cart: typeof update === 'function' ? update(state.cart) : update })),
  setBuyer: (buyer) => set({ buyer }),
  finish: (sale) => set({ last: sale, cart: [], buyer: WALK_IN }),
  clear: () => set({ cart: [], buyer: WALK_IN }),
}))
