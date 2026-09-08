import { useMemo } from 'react'
import { useDataStore, type RoleInput } from '@/data/store'
import { coverage, reachableModules, type Role } from '../model/role'

export interface RoleRow extends Role {
  /** How many people hold it — the number that makes a change feel real. */
  holders: number
  granted: number
  total: number
  ratio: number
  modules: string[]
}

const decorate = (role: Role, holders: number): RoleRow => ({
  ...role,
  holders,
  ...coverage(role),
  modules: reachableModules(role),
})

export function useRoles() {
  const roles = useDataStore((s) => s.roles)
  const employees = useDataStore((s) => s.employees)

  return useMemo(() => {
    const holders = new Map<string, number>()
    for (const employee of employees) {
      if (employee.status === 'archived') continue
      holders.set(employee.roleId, (holders.get(employee.roleId) ?? 0) + 1)
    }

    // Widest access first: the roles that can do the most are the ones worth
    // checking, and Owner belongs at the top of a list about access.
    const items = roles
      .map((role) => decorate(role, holders.get(role.id) ?? 0))
      .sort((a, b) => b.ratio - a.ratio)

    return { data: { items, total: items.length }, isLoading: false }
  }, [roles, employees])
}

export function useRole(id: string | undefined) {
  const roles = useDataStore((s) => s.roles)
  const employees = useDataStore((s) => s.employees)

  return useMemo(() => {
    const role = roles.find((r) => r.id === id)
    if (!role) return { data: undefined, isLoading: false }
    const holders = employees.filter((e) => e.roleId === role.id && e.status !== 'archived').length
    return { data: decorate(role, holders), isLoading: false }
  }, [roles, employees, id])
}

/** The people who hold a role, so a change can name who it affects. */
export function useRoleHolders(id: string | undefined) {
  const employees = useDataStore((s) => s.employees)
  return useMemo(
    () => employees.filter((e) => e.roleId === id && e.status !== 'archived'),
    [employees, id],
  )
}

export function useRoleActions() {
  const create = useDataStore((s) => s.createRole)
  const update = useDataStore((s) => s.updateRole)
  const setPermissions = useDataStore((s) => s.setRolePermissions)
  const remove = useDataStore((s) => s.deleteRole)

  return {
    create: (input: RoleInput) => create(input),
    update: (id: string, input: RoleInput) => update(id, input),
    setPermissions,
    remove,
    isPending: false,
  }
}
