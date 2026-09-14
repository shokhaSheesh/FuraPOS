import type { Employee } from '@/features/employees/model/employee'
import type { Role } from '@/features/roles/model/role'

/**
 * Signing in.
 *
 * You sign in **as an employee**, and your role's permissions come with you —
 * so a Seller who signs in sees a Seller's sidebar, and the permission tree in
 * Access & roles is something you can actually feel rather than only edit.
 *
 * There is no backend, so there are no real credentials: the login is the
 * part of an employee's work email before the @ (or the whole email), and
 * every demo account shares one password. A real build checks a hash on the
 * server and never ships a password in the client — this is the shape of the
 * screen and the rules around it, not an authentication system.
 */
export const DEMO_PASSWORD = 'fura2026'

export type SignInResult = { ok: true; employee: Employee } | { ok: false; error: string }

export function authenticate(
  employees: Employee[],
  roles: Pick<Role, 'id'>[],
  login: string,
  password: string,
): SignInResult {
  const wanted = login.trim().toLowerCase()
  if (!wanted || !password) return { ok: false, error: 'Enter your login and password' }

  const employee = employees.find((e) => {
    const email = (e.email ?? '').toLowerCase()
    return email === wanted || email.split('@')[0] === wanted
  })

  // One message for a wrong login and a wrong password: saying which one was
  // wrong tells a stranger which logins exist.
  if (!employee || password !== DEMO_PASSWORD) {
    return { ok: false, error: 'That login and password do not match' }
  }
  if (employee.status === 'suspended') {
    return { ok: false, error: 'This account is suspended. Ask an administrator to restore it.' }
  }
  if (employee.status === 'archived') {
    return { ok: false, error: 'This account has been closed.' }
  }
  if (!roles.some((role) => role.id === employee.roleId)) {
    return { ok: false, error: 'This account has no role yet. Ask an administrator to assign one.' }
  }
  return { ok: true, employee }
}
