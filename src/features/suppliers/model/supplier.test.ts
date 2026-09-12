import { describe, expect, it } from 'vitest'
import {
  generatePassword,
  isUsernameTaken,
  portalState,
  PASSWORD_LENGTH,
  suggestUsername,
  supplierFormSchema,
  USERNAME_PATTERN,
} from './supplier'

const access = (over: Partial<Parameters<typeof portalState>[0]> = {}) => ({
  access: 'granted' as const,
  username: 'akchaev',
  lastSignedInAt: null,
  ...over,
})

describe('portalState', () => {
  it('is none when no access was granted', () => {
    expect(portalState(access({ access: 'none' }))).toBe('none')
  })

  it('is none when access was granted but there is no login to use', () => {
    // Guards the half-filled record: a grant without a username is not a login.
    expect(portalState(access({ username: null }))).toBe('none')
  })

  it('is invited while a granted login has never been used', () => {
    expect(portalState(access())).toBe('invited')
  })

  it('becomes active once they have signed in', () => {
    expect(portalState(access({ lastSignedInAt: new Date().toISOString() }))).toBe('active')
  })

  it('reads as off when access is withdrawn, even after they signed in', () => {
    const withdrawn = access({ access: 'disabled', lastSignedInAt: new Date().toISOString() })
    expect(portalState(withdrawn)).toBe('disabled')
  })
})

describe('suggestUsername', () => {
  it('turns a company name into something spellable down a phone line', () => {
    expect(suggestUsername('AKCHAEV INC')).toBe('akchaev-inc')
    expect(suggestUsername('Euro Parts DMCC')).toBe('euro-parts-dmcc')
  })

  it('drops punctuation rather than encoding it, and never trails a separator', () => {
    expect(suggestUsername('Sampa Otomotiv, A.Ş.')).toBe('sampa-otomotiv-a')
  })

  it('never suggests something the pattern would then reject', () => {
    for (const name of ['AKCHAEV INC', 'Euro Parts DMCC', 'Dinex Group']) {
      expect(USERNAME_PATTERN.test(suggestUsername(name))).toBe(true)
    }
  })
})

describe('isUsernameTaken', () => {
  const suppliers = [
    { id: 'sup-1', username: 'akchaev' },
    { id: 'sup-2', username: null },
  ]

  it('catches a collision regardless of case', () => {
    expect(isUsernameTaken(suppliers, 'AKCHAEV')).toBe(true)
  })

  it('does not count the supplier being edited against itself', () => {
    expect(isUsernameTaken(suppliers, 'akchaev', 'sup-1')).toBe(false)
  })

  it('treats an empty username as no collision, so two blanks do not clash', () => {
    expect(isUsernameTaken(suppliers, '')).toBe(false)
  })
})

describe('generatePassword', () => {
  it('is the stated length', () => {
    expect(generatePassword()).toHaveLength(PASSWORD_LENGTH)
  })

  it('leaves out the glyphs that get misread aloud', () => {
    // 1000 passwords is enough to catch an alphabet that still contains them.
    const all = Array.from({ length: 1000 }, () => generatePassword()).join('')
    expect(all).not.toMatch(/[IlO01]/)
  })

  it('does not return the same password twice', () => {
    const many = new Set(Array.from({ length: 100 }, () => generatePassword()))
    expect(many.size).toBe(100)
  })
})

describe('supplierFormSchema', () => {
  const base = {
    name: 'AKCHAEV INC',
    zone: '',
    contactName: 'Rustam Akchaev',
    phone: '',
    email: '',
    address: '',
    paymentTermDays: null,
    comment: '',
    status: 'active' as const,
    access: 'none' as const,
    username: '',
    password: '',
  }

  it('accepts a supplier with no login and no username', () => {
    expect(supplierFormSchema.safeParse(base).success).toBe(true)
  })

  const granted = {
    ...base,
    access: 'granted' as const,
    username: 'akchaev',
    password: 'sekret123',
  }

  it('will not grant access without a valid username', () => {
    const result = supplierFormSchema.safeParse({ ...granted, username: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'username')).toBe(true)
  })

  it('will not grant access without a password to sign in with', () => {
    const result = supplierFormSchema.safeParse({ ...granted, password: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'password')).toBe(true)
  })

  it('rejects a password too short to be worth having', () => {
    const result = supplierFormSchema.safeParse({ ...granted, password: 'abc123' })
    expect(result.success).toBe(false)
  })

  it('will not grant access without naming who holds it', () => {
    const result = supplierFormSchema.safeParse({ ...granted, contactName: '  ' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'contactName')).toBe(true)
  })

  it('rejects a username with capitals or spaces', () => {
    for (const username of ['Akchaev', 'akchaev inc', '.akchaev', 'ak']) {
      const result = supplierFormSchema.safeParse({ ...granted, username })
      expect(result.success, username).toBe(false)
    }
  })

  it('accepts a granted login that is fully specified', () => {
    expect(supplierFormSchema.safeParse(granted).success).toBe(true)
  })
})
