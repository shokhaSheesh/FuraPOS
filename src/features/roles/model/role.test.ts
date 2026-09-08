import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { ALL_PERMISSIONS, permissionTree } from '@/shared/config/permissions'
import {
  coverage,
  grantedKeys,
  holds,
  isFullAccess,
  keysUnder,
  leavesOf,
  reachableModules,
  tickState,
  withImpliedView,
  withoutImpliedActions,
} from './role'

const products = permissionTree.find((node) => node.key === 'products')!
const productList = leavesOf(products).find((leaf) => leaf.key === 'products.list')!

describe('reading the tree', () => {
  it('finds the leaves that actually carry actions', () => {
    expect(leavesOf(products).every((leaf) => leaf.actions)).toBe(true)
    expect(leavesOf(products).map((l) => l.key)).toContain('products.suppliers')
  })

  it('expands a node to every grantable key beneath it', () => {
    expect(keysUnder(productList)).toEqual([
      'products.list.view',
      'products.list.create',
      'products.list.edit',
      'products.list.delete',
      'products.list.export',
    ])
  })
})

describe('partial access', () => {
  it('is off when nothing under it is granted', () => {
    expect(tickState(new Set(), keysUnder(productList))).toBe('off')
  })

  it('is on only when everything under it is granted', () => {
    expect(tickState(new Set(keysUnder(productList)), keysUnder(productList))).toBe('on')
  })

  it('is partial in between — the case a yes/no checkbox cannot express', () => {
    const some = new Set(['products.list.view', 'products.list.export'])
    expect(tickState(some, keysUnder(productList))).toBe('partial')
  })

  it('is off for a group with nothing in it', () => {
    expect(tickState(new Set(['anything']), [])).toBe('off')
  })
})

describe('implied permissions', () => {
  it('grants view alongside any other action', () => {
    // Editing something you cannot see is a permission nobody can use.
    const next = withImpliedView(new Set(), 'products.list', 'edit')
    expect([...next].sort()).toEqual(['products.list.edit', 'products.list.view'])
  })

  it('grants view on its own without adding anything else', () => {
    expect([...withImpliedView(new Set(), 'products.list', 'view')]).toEqual(['products.list.view'])
  })

  it('takes everything else away when view is removed', () => {
    const all = new Set(keysUnder(productList))
    const next = withoutImpliedActions(all, productList, 'view')
    expect(next.size).toBe(0)
  })

  it('removing one action leaves the rest alone', () => {
    const all = new Set(keysUnder(productList))
    const next = withoutImpliedActions(all, productList, 'delete')
    expect(next.has('products.list.delete')).toBe(false)
    expect(next.has('products.list.view')).toBe(true)
    expect(next.size).toBe(4)
  })

  it('does not mutate what it was given', () => {
    const original = new Set(['products.list.view'])
    withImpliedView(original, 'products.list', 'edit')
    withoutImpliedActions(original, productList, 'view')
    expect([...original]).toEqual(['products.list.view'])
  })
})

describe('full access', () => {
  const owner = { permissions: ['*'] }

  it('expands to every key in the tree', () => {
    expect(isFullAccess(owner)).toBe(true)
    expect(grantedKeys(owner)).toEqual(ALL_PERMISSIONS)
    expect(coverage(owner).ratio).toBe(1)
  })

  it('holds a permission that does not exist yet', () => {
    // The point of `*`: a module added next month is included without anyone
    // remembering to tick it.
    expect(holds(owner, 'somethingBuiltNextYear.view')).toBe(true)
  })

  it('reaches every module', () => {
    expect(reachableModules(owner)).toHaveLength(permissionTree.length)
  })
})

describe('a role scoped to part of the product', () => {
  const seller = { permissions: ['sales.orders.view', 'sales.orders.create'] }

  it('holds what it was given and nothing more', () => {
    expect(holds(seller, 'sales.orders.create')).toBe(true)
    expect(holds(seller, 'sales.orders.delete')).toBe(false)
    expect(holds(seller, 'finance.pnl.view')).toBe(false)
  })

  it('names only the modules it can reach', () => {
    expect(reachableModules(seller)).toEqual(['Sales'])
  })
})

describe('the seeded roles', () => {
  const roles = () => useDataStore.getState().roles

  it('gives the storekeeper stock but never a price', () => {
    const storekeeper = roles().find((r) => r.name === 'Storekeeper')!
    expect(holds(storekeeper, 'products.transfers.create')).toBe(true)
    expect(holds(storekeeper, 'products.cost.view')).toBe(false)
    expect(holds(storekeeper, 'products.repricing.edit')).toBe(false)
  })

  it('gives the seller no sight of cost price', () => {
    // Otherwise they can work out how far they are allowed to discount.
    const seller = roles().find((r) => r.name === 'Seller')!
    expect(holds(seller, 'sales.orders.create')).toBe(true)
    expect(holds(seller, 'products.cost.view')).toBe(false)
  })

  it('gives the accountant every figure and nothing that moves stock', () => {
    const accountant = roles().find((r) => r.name === 'Accountant')!
    expect(holds(accountant, 'products.cost.view')).toBe(true)
    expect(holds(accountant, 'personnel.salary.view')).toBe(true)
    expect(holds(accountant, 'analytics.reportBuilder.export')).toBe(true)
    expect(holds(accountant, 'products.transfers.create')).toBe(false)
  })

  it('grants nothing that is not in the tree', () => {
    const known = new Set(ALL_PERMISSIONS)
    for (const role of roles()) {
      if (isFullAccess(role)) continue
      for (const key of role.permissions) expect(known.has(key)).toBe(true)
    }
  })
})

describe('protecting the way back in', () => {
  const owner = () => useDataStore.getState().roles.find((r) => r.isSystem)!

  it('refuses to strip the system role', () => {
    useDataStore.getState().setRolePermissions(owner().id, [])
    expect(owner().permissions).toEqual(['*'])
  })

  it('refuses to delete the system role', () => {
    const result = useDataStore.getState().deleteRole(owner().id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/cannot be deleted/)
  })

  it('refuses to delete a role people still hold', () => {
    const seller = useDataStore.getState().roles.find((r) => r.name === 'Seller')!
    const result = useDataStore.getState().deleteRole(seller.id)
    // They would be left holding a role that does not exist, reaching nothing.
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/hold this role/)
  })

  it('deletes a role nobody holds', () => {
    const role = useDataStore.getState().createRole({ name: 'Temp' })
    expect(role.permissions).toEqual([])
    expect(useDataStore.getState().deleteRole(role.id)).toEqual({ ok: true })
  })

  it('starts a new role with no access rather than copying one', () => {
    const role = useDataStore.getState().createRole({ name: 'Fresh' })
    expect(coverage(role).granted).toBe(0)
    expect(role.isSystem).toBe(false)
  })

  it('saves permissions on an ordinary role', () => {
    const role = useDataStore.getState().createRole({ name: 'Scoped' })
    useDataStore.getState().setRolePermissions(role.id, ['sales.orders.view'])
    const after = useDataStore.getState().roles.find((r) => r.id === role.id)!
    expect(after.permissions).toEqual(['sales.orders.view'])
  })
})
