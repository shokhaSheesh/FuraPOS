import { DEFAULT_PAGE_SIZE, type ListQuery, type Paginated } from '@/shared/types'

/**
 * Local list helpers. There is no server: the app reads these arrays straight
 * from memory, so "paginating" is slicing and "filtering" is a predicate.
 */
export function paginate<T>(items: T[], query: ListQuery): Paginated<T> {
  const page = Number(query.page ?? 1)
  const pageSize = Number(query.pageSize ?? DEFAULT_PAGE_SIZE)
  const sort = query.sort ? String(query.sort) : null
  const order = query.order === 'desc' ? -1 : 1

  let result = items
  if (sort) {
    result = [...items].sort((a, b) => {
      const left = (a as Record<string, unknown>)[sort]
      const right = (b as Record<string, unknown>)[sort]
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * order
      return String(left).localeCompare(String(right)) * order
    })
  }

  const start = (page - 1) * pageSize
  return { items: result.slice(start, start + pageSize), total: result.length, page, pageSize }
}

export function matches(haystack: (string | null | undefined)[], needle: unknown): boolean {
  const term = typeof needle === 'string' ? needle.trim().toLowerCase() : ''
  if (!term) return true
  return haystack.some((value) => value?.toLowerCase().includes(term))
}
