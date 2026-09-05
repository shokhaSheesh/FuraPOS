import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { DEFAULT_PAGE_SIZE, type ListQuery, type ListQueryPatch } from '@/shared/types'

/**
 * List state (page, size, search, sort, filters) lives in the URL, not in
 * component state — so a filtered table is shareable, bookmarkable, and
 * survives a refresh. Every list screen should use this instead of useState.
 */
export function useListQuery(defaults: ListQuery = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useMemo<ListQuery>(() => {
    const entries = Object.fromEntries(searchParams.entries())
    return {
      ...defaults,
      ...entries,
      page: Number(entries.page ?? defaults.page ?? 1),
      pageSize: Number(entries.pageSize ?? defaults.pageSize ?? DEFAULT_PAGE_SIZE),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setQuery = useCallback(
    (patch: ListQueryPatch) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === '') next.delete(key)
            else next.set(key, String(value))
          }
          // Any filter change resets to the first page — never strand the user
          // on page 7 of a 2-page result.
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { query, setQuery }
}
