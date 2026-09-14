import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { authenticate, DEMO_PASSWORD } from './auth'

const run = (login: string, password = DEMO_PASSWORD) => {
  const { employees, roles } = useDataStore.getState()
  return authenticate(employees, roles, login, password)
}

describe('authenticate', () => {
  it('signs in with the part of the email before the @', () => {
    const result = run('akhmet')
    expect(result.ok && result.employee.fullName).toBe('Akhmet Dauletmuratov')
  })

  it('also takes the whole email, in any case', () => {
    expect(run('AKHMET@fura.uz').ok).toBe(true)
  })

  it("checks the employee's own password, so changing it changes how they sign in", () => {
    const store = useDataStore.getState()
    const nodira = store.employees.find((e) => e.login === 'nodira')!
    store.updateEmployee(nodira.id, { ...nodira, password: 'new-secret-9' })
    expect(run('nodira').ok).toBe(false)
    expect(run('nodira', 'new-secret-9').ok).toBe(true)
  })

  it('gives the same message for a wrong login and a wrong password', () => {
    const wrongLogin = run('nobody')
    const wrongPassword = run('akhmet', 'nope')
    expect(wrongLogin.ok || wrongPassword.ok).toBe(false)
    if (!wrongLogin.ok && !wrongPassword.ok) expect(wrongLogin.error).toBe(wrongPassword.error)
  })

  it('refuses a suspended account', () => {
    const result = run('jasur')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/suspended/)
  })

  it('refuses an account of someone who has left', () => {
    const result = run('bekzod')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/closed/)
  })

  it('asks for both fields before checking anything', () => {
    const result = run('', '')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Enter/)
  })
})
