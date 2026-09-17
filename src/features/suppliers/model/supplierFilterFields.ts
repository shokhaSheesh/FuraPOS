import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import type { SupplierRow } from '../api/suppliers'
import { isDormant, portalState, portalStateLabel, type PortalState } from './supplier'

/**
 * The suppliers list's search panel. A row is a supplier with its numbers
 * attached, so every column reads through one or the other.
 */
export const SUPPLIER_FILTER_OVERRIDES: FieldOverrides<SupplierRow> = {
  name: { type: 'text', get: (r) => r.supplier.name },
  debt: { get: (r) => r.supplier.debt },
  lastPayment: { type: 'date', get: (r) => r.supplier.lastPaymentAt },
  sold: {
    unit: '%',
    get: (r) => (r.stats.purchased === 0 ? null : Math.round(r.stats.soldRatio * 100)),
  },
  onHand: { get: (r) => r.stats.onHandUnits },
  purchased: { get: (r) => r.stats.purchased },
  products: { get: (r) => r.stats.products },
  zone: { type: 'options', get: (r) => r.supplier.zone },
  portal: {
    type: 'options',
    get: (r) => portalState(r.supplier),
    optionLabel: (value) => portalStateLabel(value as PortalState),
  },
  activity: {
    type: 'options',
    get: (r) => (isDormant(r.stats) ? 'dormant' : 'active'),
    optionLabel: (value) => (value === 'dormant' ? 'Nothing in 90 days' : 'Delivered lately'),
  },
  phone: { type: 'text', get: (r) => r.supplier.phone },
}
