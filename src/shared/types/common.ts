export type Id = string
export type IsoDate = string

/** Every list endpoint in the app returns this envelope. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Every list endpoint in the app accepts these params. */
export interface ListQuery {
  page?: number
  pageSize?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  [key: string]: string | number | boolean | null | undefined
}

/** A partial update to a ListQuery; `null` clears the param from the URL. */
export type ListQueryPatch = Record<string, string | number | boolean | null | undefined>

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface SelectOption<T = string> {
  value: T
  label: string
}
