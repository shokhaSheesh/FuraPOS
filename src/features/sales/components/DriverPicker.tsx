import { useEffect, useState } from 'react'
import { Check, ChevronDown, ScanLine, Truck } from 'lucide-react'
import { Popover } from '@/shared/ui/Popover'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'
import { useActiveDrivers } from '@/features/drivers/api/drivers'
import { KIND_LABEL, kindOf, type Driver } from '@/features/drivers/model/driver'

/**
 * Who collected the parts.
 *
 * A driver's QR code carries his `code`, so a scanner types it straight into
 * the search box and the list narrows to one — the same field also takes a
 * name, a phone or a **number plate**, because at a counter people often know
 * the truck before they know the man.
 *
 * Most counter sales still have no driver; this stays optional and empty.
 */
export function DriverPicker({
  value,
  onChange,
}: {
  value: Driver | null
  onChange: (driver: Driver | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const drivers = useActiveDrivers(debounced)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 200)
    return () => clearTimeout(timer)
  }, [term])

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-80"
      trigger={
        <Button variant="secondary" className="w-full justify-start font-normal">
          <ScanLine />
          <span className={cn('flex-1 truncate text-left', !value && 'text-fg-muted')}>
            {value ? value.fullName : 'No driver'}
          </span>
          <ChevronDown className="text-fg-subtle" />
        </Button>
      }
    >
      <div className="border-border border-b p-2">
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Scan the QR, or search name or plate…"
          aria-label="Search drivers"
          className="h-8"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto p-1">
        <li>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className="hover:bg-canvas flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
          >
            <span className="flex-1">No driver</span>
            {value === null ? <Check className="text-fg-subtle size-4" /> : null}
          </button>
        </li>
        {drivers.map((driver) => (
          <li key={driver.id}>
            <button
              type="button"
              onClick={() => {
                onChange(driver)
                setOpen(false)
              }}
              className="hover:bg-canvas flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="text-fg flex items-center gap-1.5 truncate">
                  {driver.fullName}
                  <Badge tone="neutral">{KIND_LABEL[kindOf(driver)]}</Badge>
                </p>
                <p className="text-fg-subtle text-2xs flex items-center gap-1 truncate">
                  <span className="font-mono">{driver.code}</span>
                  {driver.autoparkName ? <span>· {driver.autoparkName}</span> : null}
                  <Truck className="size-3 shrink-0" />
                  {driver.ownTruckPlate ?? driver.autoparkTruckPlate}
                </p>
              </div>
              {value?.id === driver.id ? <Check className="text-fg-subtle mt-0.5 size-4" /> : null}
            </button>
          </li>
        ))}
        {drivers.length === 0 ? (
          <li className="text-fg-subtle px-2 py-4 text-center text-sm">No driver matches</li>
        ) : null}
      </ul>
    </Popover>
  )
}
