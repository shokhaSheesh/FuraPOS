import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/shared/ui/Checkbox'
import { SearchInput } from '@/shared/components/SearchInput'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import {
  PERMISSION_ACTIONS,
  permissionTree,
  type PermissionAction,
  type PermissionNode,
} from '@/shared/config/permissions'
import {
  keysUnder,
  leavesOf,
  tickState,
  withImpliedView,
  withoutImpliedActions,
} from '../model/role'

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
}

/**
 * The permission tree, as a grid.
 *
 * Rows are the things that can be reached, columns are the five actions. The
 * obvious alternative — nested checkboxes, one per permission — is 118 boxes
 * in a list with no shape, where "can this person delete a sale" takes ten
 * seconds to answer. As a grid it takes one glance down a column.
 *
 * A leaf that has no such action shows a dash rather than a disabled box: an
 * empty cell says "not applicable", a greyed box says "you are not allowed to
 * change this", and they are different statements.
 */
export function PermissionGrid({
  granted,
  onChange,
  readOnly = false,
}: {
  granted: Set<string>
  onChange: (next: Set<string>) => void
  /** The Owner role is shown, never edited. */
  readOnly?: boolean
}) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const modules = useMemo(() => {
    const term = search.trim().toLowerCase()
    return permissionTree
      .map((node) => ({
        node,
        leaves: leavesOf(node).filter(
          (leaf) =>
            !term ||
            leaf.label.toLowerCase().includes(term) ||
            node.label.toLowerCase().includes(term),
        ),
      }))
      .filter((entry) => entry.leaves.length > 0)
  }, [search])

  const setKeys = (next: Set<string>) => {
    if (readOnly) return
    onChange(next)
  }

  const toggleLeafAction = (leaf: PermissionNode, action: PermissionAction, on: boolean) => {
    setKeys(
      on
        ? withImpliedView(granted, leaf.key, action)
        : withoutImpliedActions(granted, leaf, action),
    )
  }

  const toggleAll = (keys: string[], on: boolean) => {
    const next = new Set(granted)
    for (const key of keys) {
      if (on) next.add(key)
      else next.delete(key)
    }
    setKeys(next)
  }

  const totalGranted = useMemo(() => granted.size, [granted])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Find a screen or permission…"
        />
        <p className="text-fg-subtle text-2xs tabular-nums">{formatNumber(totalGranted)} granted</p>
      </div>

      <div className="border-border rounded-card overflow-x-auto border">
        <table className="w-full text-sm">
          <thead className="bg-canvas sticky top-0">
            <tr className="text-fg-muted text-2xs tracking-wide uppercase">
              <th className="px-3 py-2 text-left font-semibold">Can reach</th>
              {PERMISSION_ACTIONS.map((action) => (
                <th key={action} className="w-20 px-3 py-2 text-center font-semibold">
                  {ACTION_LABELS[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map(({ node, leaves }) => {
              const moduleKeys = leaves.flatMap((leaf) =>
                (leaf.actions ?? []).map((action) => `${leaf.key}.${action}`),
              )
              const state = tickState(granted, moduleKeys)
              const isCollapsed = collapsed.has(node.key)

              return (
                <ModuleRows
                  key={node.key}
                  node={node}
                  leaves={leaves}
                  granted={granted}
                  state={state}
                  collapsed={isCollapsed}
                  readOnly={readOnly}
                  onToggleCollapse={() =>
                    setCollapsed((current) => {
                      const next = new Set(current)
                      if (next.has(node.key)) next.delete(node.key)
                      else next.add(node.key)
                      return next
                    })
                  }
                  onToggleModule={(on) => toggleAll(moduleKeys, on)}
                  onToggleLeaf={toggleLeafAction}
                  onToggleLeafRow={(leaf, on) => toggleAll(keysUnder(leaf), on)}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {modules.length === 0 ? (
        <p className="text-fg-subtle py-6 text-center text-sm">Nothing matches “{search}”.</p>
      ) : null}
    </div>
  )
}

function ModuleRows({
  node,
  leaves,
  granted,
  state,
  collapsed,
  readOnly,
  onToggleCollapse,
  onToggleModule,
  onToggleLeaf,
  onToggleLeafRow,
}: {
  node: PermissionNode
  leaves: PermissionNode[]
  granted: Set<string>
  state: 'on' | 'off' | 'partial'
  collapsed: boolean
  readOnly: boolean
  onToggleCollapse: () => void
  onToggleModule: (on: boolean) => void
  onToggleLeaf: (leaf: PermissionNode, action: PermissionAction, on: boolean) => void
  onToggleLeafRow: (leaf: PermissionNode, on: boolean) => void
}) {
  return (
    <>
      <tr className="border-border bg-surface-inset/60 border-t">
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              aria-label={`All of ${node.label}`}
              disabled={readOnly}
              checked={state === 'partial' ? 'indeterminate' : state === 'on'}
              onCheckedChange={onToggleModule}
            />
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-fg hover:text-fg flex items-center gap-1 font-medium"
            >
              {node.label}
              <ChevronDown
                className={cn('size-3.5 transition-transform', collapsed && '-rotate-90')}
              />
            </button>
          </div>
        </td>
        <td colSpan={PERMISSION_ACTIONS.length} className="text-fg-subtle text-2xs px-3 py-2">
          {leaves.length === 1 && leaves[0]?.key === node.key
            ? null
            : `${leaves.length} ${leaves.length === 1 ? 'screen' : 'screens'}`}
        </td>
      </tr>

      {collapsed
        ? null
        : leaves.map((leaf) => {
            const rowState = tickState(granted, keysUnder(leaf))
            return (
              <tr key={leaf.key} className="border-border hover:bg-surface-inset/40 border-t">
                <td className="py-1.5 pr-3 pl-9">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      aria-label={`All of ${leaf.label}`}
                      disabled={readOnly}
                      checked={rowState === 'partial' ? 'indeterminate' : rowState === 'on'}
                      onCheckedChange={(on) => onToggleLeafRow(leaf, on)}
                    />
                    <span className="text-fg-muted">{leaf.label}</span>
                  </label>
                </td>
                {PERMISSION_ACTIONS.map((action) => {
                  const applies = leaf.actions?.includes(action)
                  if (!applies) {
                    return (
                      <td key={action} className="text-fg-subtle px-3 py-1.5 text-center">
                        <span aria-label="not applicable">–</span>
                      </td>
                    )
                  }
                  return (
                    <td key={action} className="px-3 py-1.5 text-center">
                      <span className="inline-flex">
                        <Checkbox
                          aria-label={`${ACTION_LABELS[action]} ${leaf.label}`}
                          disabled={readOnly}
                          checked={granted.has(`${leaf.key}.${action}`)}
                          onCheckedChange={(on) => onToggleLeaf(leaf, action, on)}
                        />
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
    </>
  )
}
