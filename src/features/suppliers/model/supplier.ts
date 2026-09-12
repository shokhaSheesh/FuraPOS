import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Who we buy from.
 *
 * OX's Поставщики is the most substantial screen in the product, and reading it
 * explains why: it is not a contact list. Every column is money or movement —
 * what we owe, when we last paid, what we bought, what is still on the shelf,
 * how much of it has sold. A supplier's name and phone number are the least
 * interesting thing about it.
 *
 * We follow that. Contact details exist because someone has to be rung, but the
 * screen answers "how is this relationship going".
 */
export interface Supplier {
  id: Id
  name: string
  /** Broad region, as OX's `Зона` column — "Uzbekistan", "Türkiye". */
  zone: string | null
  /**
   * The one person answerable for this company — who gets rung, and who holds
   * the portal login below. Deliberately the same person rather than a
   * "manager" beside a "contact": two name fields for one human is how a record
   * ends up with two spellings and nobody knowing which of them to call.
   */
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  /** Days we are given to pay. Null when nothing was agreed. */
  paymentTermDays: number | null
  /**
   * What we owe them, positive. Kept on the supplier rather than derived from
   * receipts, because an invoice can be paid before or after its goods arrive
   * and the two are not the same ledger.
   */
  debt: number
  lastPaymentAt: IsoDate | null
  /**
   * Whether their manager can sign in to the supplier portal — the separate
   * app where they see what we order from them. This is the *grant*, not the
   * state: `portalState` below works out whether a granted login has actually
   * been used, because two stored fields that must agree eventually disagree.
   */
  access: SupplierAccess
  /** What they sign in as. Kept when access is switched off, so turning it back on is the same login. */
  username: string | null
  /**
   * What they sign in with, in plain text and readable on their page.
   *
   * A once-only reveal was tried and rejected for good reason: whoever hands
   * the login over needs to be able to look it up when the supplier rings back
   * a week later saying they cannot get in. Somebody writing it in a notebook
   * instead is worse than showing it here.
   *
   * **This is a design-stage decision, not a licence for the real build.** When
   * a backend exists it must store a hash and let this be reset, not read —
   * see docs/OX-NAVIGATION-MAP.md.
   */
  password: string | null
  /** When the password was last changed. */
  passwordSetAt: IsoDate | null
  /** Null when they have never signed in. Shown on their page, not in the status. */
  lastSignedInAt: IsoDate | null
  comment: string | null
  status: 'active' | 'archived'
  createdAt: IsoDate
  updatedAt: IsoDate
}

/** Whether a login exists at all, and whether it is currently allowed to work. */
export type SupplierAccess = 'none' | 'granted' | 'disabled'

/**
 * Whether they can sign in, and nothing more.
 *
 * This was four states once — no login, invited, active, access off — which
 * distinguished things the person reading the column does not have to care
 * about. Whether a granted login has been used yet, and whether an unusable one
 * has a username behind it, are both answerable from the supplier's own page;
 * in a list they are noise dressed as information.
 */
export type PortalState = 'active' | 'inactive'

export function portalState(supplier: Pick<Supplier, 'access' | 'username'>): PortalState {
  // A grant with no login behind it cannot be signed in with, so it is not
  // active however the access flag reads.
  return supplier.access === 'granted' && supplier.username ? 'active' : 'inactive'
}

export const PORTAL_STATES: {
  value: PortalState
  label: string
  tone: 'success' | 'neutral'
  hint: string
}[] = [
  { value: 'active', label: 'Active', tone: 'success', hint: 'Can sign in to the supplier portal' },
  {
    value: 'inactive',
    // Covers both "never had a login" and "had one, switched off" — the second
    // stays reversible, because the username is kept either way.
    label: 'Inactive',
    tone: 'neutral',
    hint: 'Cannot sign in',
  },
]

const portalMeta = (state: PortalState) => PORTAL_STATES.find((entry) => entry.value === state)!

export const portalStateLabel = (state: PortalState) => portalMeta(state).label
export const portalStateTone = (state: PortalState) => portalMeta(state).tone
export const portalStateHint = (state: PortalState) => portalMeta(state).hint

/**
 * A username proposed from the company name, because one typed by hand is one
 * that collides. Punctuation and case go, because a login somebody has to
 * spell down a phone line should not contain either.
 */
export function suggestUsername(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
}

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,}$/

/** Two suppliers signing in as the same name would be two companies in one account. */
export function isUsernameTaken(
  suppliers: Pick<Supplier, 'id' | 'username'>[],
  username: string,
  exceptId?: string,
): boolean {
  const wanted = username.trim().toLowerCase()
  if (!wanted) return false
  return suppliers.some(
    (entry) => entry.id !== exceptId && (entry.username ?? '').toLowerCase() === wanted,
  )
}

/*
 * Ambiguous glyphs are left out on purpose. These passwords get read aloud or
 * copied into a message, and `I`/`l`/`1` and `O`/`0` are where that goes wrong.
 */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export const PASSWORD_LENGTH = 12

export function generatePassword(length = PASSWORD_LENGTH): string {
  const size = PASSWORD_ALPHABET.length
  // crypto where it exists, because a predictable password is not a password.
  const random =
    typeof globalThis.crypto?.getRandomValues === 'function'
      ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(length)))
      : Array.from({ length }, () => Math.floor(Math.random() * size))
  return random.map((value) => PASSWORD_ALPHABET[value % size]).join('')
}

/**
 * What a supplier looks like once the receipts and the catalogue are read.
 * Derived, never stored: a stored total is a total that goes stale.
 */
export interface SupplierStats {
  /** Landed value of everything received from them. */
  purchased: number
  purchasedUnits: number
  /** Units still on a shelf that came from them, and what they are worth. */
  onHandUnits: number
  onHandValue: number
  /**
   * Roughly how much of what we bought has since sold, by value. The same
   * estimate as a receipt's sell-through and with the same caveat: without lot
   * tracking, stock still on the shelf is assumed to be theirs.
   */
  soldValue: number
  soldRatio: number
  receipts: number
  lastReceiptAt: IsoDate | null
  /** Distinct products ever received from them. */
  products: number
}

/** No receipt and nothing sold in this long counts as dormant. */
export const DORMANT_DAYS = 90

export const isDormant = (stats: Pick<SupplierStats, 'lastReceiptAt'>) => {
  if (!stats.lastReceiptAt) return true
  return Date.now() - new Date(stats.lastReceiptAt).getTime() > DORMANT_DAYS * 86_400_000
}

export const owesMoney = (supplier: Pick<Supplier, 'debt'>) => supplier.debt > 0

/**
 * How overdue a debt is, in days past the agreed terms. Null when nothing is
 * owed or no terms were agreed — an unpaid invoice is not late until someone
 * said when it was due.
 */
export function daysOverdue(
  supplier: Pick<Supplier, 'debt' | 'lastPaymentAt' | 'paymentTermDays'>,
): number | null {
  if (supplier.debt <= 0 || supplier.paymentTermDays === null) return null
  const since = supplier.lastPaymentAt ? new Date(supplier.lastPaymentAt).getTime() : null
  if (since === null) return null
  const elapsed = (Date.now() - since) / 86_400_000
  const over = Math.floor(elapsed - supplier.paymentTermDays)
  return over > 0 ? over : null
}

/* --- validation --------------------------------------------------------- */

export const supplierFormSchema = z
  .object({
    name: z.string().min(2, 'A supplier needs a name'),
    zone: z.string(),
    contactName: z.string(),
    phone: z.string(),
    email: z.string().refine((value) => value === '' || /.+@.+\..+/.test(value), 'Not an email'),
    address: z.string(),
    paymentTermDays: z.number().int().nonnegative().nullable(),
    comment: z.string(),
    status: z.enum(['active', 'archived']),
    access: z.enum(['none', 'granted', 'disabled']),
    username: z.string(),
    password: z.string(),
  })
  .superRefine((values, ctx) => {
    // None of this has to be valid if nobody is going to sign in with it.
    if (values.access === 'none') return
    if (!values.contactName.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactName'],
        message: 'Name the person who will hold the login',
      })
    }
    if (!USERNAME_PATTERN.test(values.username.trim())) {
      ctx.addIssue({
        code: 'custom',
        path: ['username'],
        message:
          'At least 3 characters: lowercase letters, digits, dot, dash or underscore, starting with a letter or digit',
      })
    }
    if (values.password.trim().length < MIN_PASSWORD_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: `At least ${MIN_PASSWORD_LENGTH} characters — use Generate if you would rather not think of one`,
      })
    }
  })

/** Short enough to type over the phone, long enough not to be guessed. */
export const MIN_PASSWORD_LENGTH = 8

export type SupplierFormValues = z.infer<typeof supplierFormSchema>

export const paymentSchema = z.object({
  amount: z.number().positive('How much was paid?'),
  comment: z.string(),
  /** A receipt id, or the sentinel meaning "spread it across what is owed". */
  receiptId: z.string(),
})

export type PaymentValues = z.infer<typeof paymentSchema>
