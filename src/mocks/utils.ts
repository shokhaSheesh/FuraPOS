import { DEFAULT_PAGE_SIZE, type Paginated } from '@/shared/types'

/** Mirrors the pagination/sort/search contract every list endpoint must honour. */
export function paginate<T>(items: T[], url: URL): Paginated<T> {
  const page = Number(url.searchParams.get('page') ?? 1)
  const pageSize = Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE)
  const sort = url.searchParams.get('sort')
  const order = url.searchParams.get('order') === 'desc' ? -1 : 1

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

export function matches(haystack: (string | null)[], needle: string | null) {
  if (!needle) return true
  const query = needle.trim().toLowerCase()
  return haystack.some((value) => value?.toLowerCase().includes(query))
}
