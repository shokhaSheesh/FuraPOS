import {
  subtreeOf,
  type CategoryNode,
  type ProductGroup,
} from '@/shared/components/catalogue/browse'
import type { TillBrowse } from '../components/TillCatalogueSidebar'

/*
  The till's shelf is narrowed two ways at once (client request): by category
  and by the truck a part fits. The sidebar's tree sets one, the filter beside
  the view switcher the other — and each counts only what the other lets by.
*/

/** The products that fit the chosen make and model, if any. */
export const fitsTruck = <G extends ProductGroup>(groups: G[], browse: TillBrowse) =>
  groups.filter(
    (g) =>
      (!browse.make || g.vehicleMakes.includes(browse.make)) &&
      (!browse.model || g.vehicleModels.includes(browse.model)),
  )

/** The products filed under the chosen category or beneath it, if any. */
export function inCategory<G extends ProductGroup>(
  groups: G[],
  browse: TillBrowse,
  categories: CategoryNode[],
) {
  if (!browse.categoryId) return groups
  const ids = subtreeOf(browse.categoryId, categories)
  return groups.filter((g) => ids.has(g.categoryId))
}
