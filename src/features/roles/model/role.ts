import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'
import {
  ALL_PERMISSIONS,
  permissionTree,
  type PermissionAction,
  type PermissionNode,
} from '@/shared/config/permissions'

/**
 * What a role can reach.
 *
 * A role is a named set of permission keys. It exists because granting access
 * person by person does not survive contact with staff turnover: the fifth
 * seller you hire should inherit what the other four have, and when the rules
 * change they should change in one place rather than five.
 *
 * The tree is `src/shared/config/permissions.ts`, which also drives the route
 * guards and the sidebar. That is the point — a permission a role cannot be
 * granted is a permission nothing can check, so there is exactly one list.
 */
export interface Role {
  id: Id
  name: string
  /**
   * Granted `module.section.action` keys. The single entry `*` means
   * everything, and is what makes the Owner role future-proof: a module added
   * next month is included without anybody remembering to tick it.
   */
  permissions: string[]
  /**
   * A role the product depends on, which cannot be deleted or stripped. There
   * is exactly one — Owner — because a system where every administrator can be
   * locked out is a system that will eventually lock everyone out.
   */
  isSystem: boolean
  createdAt: IsoDate
  updatedAt: IsoDate
}

export const isFullAccess = (role: Pick<Role, 'permissions'>) => role.permissions.includes('*')

/** Every key a role actually holds, with `*` expanded. */
export const grantedKeys = (role: Pick<Role, 'permissions'>) =>
  isFullAccess(role) ? ALL_PERMISSIONS : role.permissions

export const holds = (role: Pick<Role, 'permissions'>, key: string) =>
  isFullAccess(role) || role.permissions.includes(key)

/* --- reading the tree ---------------------------------------------------- */

/** Every leaf under a node — the nodes that actually carry actions. */
export function leavesOf(node: PermissionNode): PermissionNode[] {
  if (node.actions) return [node]
  return (node.children ?? []).flatMap(leavesOf)
}

/** Every grantable key under a node. */
export const keysUnder = (node: PermissionNode): string[] =>
  leavesOf(node).flatMap((leaf) => (leaf.actions ?? []).map((action) => `${leaf.key}.${action}`))

export type TickState = 'on' | 'off' | 'partial'

/**
 * Whether a group is fully granted, partly granted, or not at all.
 *
 * **Partial is a real state, not a rounding error.** A manager who can view
 * every finance report but edit none of them is the normal case, and a
 * checkbox that can only say yes or no forces whoever set it up to choose
 * between over-granting and clicking twenty boxes.
 */
export function tickState(granted: Set<string>, keys: string[]): TickState {
  if (keys.length === 0) return 'off'
  let on = 0
  for (const key of keys) if (granted.has(key)) on += 1
  if (on === 0) return 'off'
  return on === keys.length ? 'on' : 'partial'
}

/**
 * Granting an action generally implies being able to see the thing.
 *
 * Someone who can edit a product but not view the product list holds a
 * permission they can never use, and that is a configuration mistake rather
 * than a deliberate choice — so ticking any action ticks `view` with it.
 */
export function withImpliedView(keys: Set<string>, leafKey: string, action: PermissionAction) {
  const next = new Set(keys)
  next.add(`${leafKey}.${action}`)
  if (action !== 'view') next.add(`${leafKey}.view`)
  return next
}

/**
 * Removing `view` removes everything else on that leaf, for the same reason:
 * the leftovers would be unusable.
 */
export function withoutImpliedActions(
  keys: Set<string>,
  leaf: PermissionNode,
  action: PermissionAction,
) {
  const next = new Set(keys)
  next.delete(`${leaf.key}.${action}`)
  if (action === 'view') {
    for (const other of leaf.actions ?? []) next.delete(`${leaf.key}.${other}`)
  }
  return next
}

/** How much of the whole tree a role holds, for the list's summary column. */
export function coverage(role: Pick<Role, 'permissions'>) {
  const granted = grantedKeys(role).length
  return { granted, total: ALL_PERMISSIONS.length, ratio: granted / ALL_PERMISSIONS.length }
}

/** The modules a role can reach at all, named — more use than a count alone. */
export function reachableModules(role: Pick<Role, 'permissions'>): string[] {
  if (isFullAccess(role)) return permissionTree.map((node) => node.label)
  const granted = new Set(role.permissions)
  return permissionTree
    .filter((node) => keysUnder(node).some((key) => granted.has(key)))
    .map((node) => node.label)
}

/* --- validation ---------------------------------------------------------- */

export const roleDraftSchema = z.object({
  name: z.string().min(2, 'Give the role a name'),
})

export type RoleDraft = z.infer<typeof roleDraftSchema>
