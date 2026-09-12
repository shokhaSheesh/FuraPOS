import { useEffect, useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Input } from '@/shared/ui/Input'
import { Field } from '@/shared/components/Field'
import { toast } from '@/shared/ui/toast'
import { useDriverActions } from '@/features/drivers/api/drivers'
import { driverSchema, type Driver, type DriverDraft } from '@/features/drivers/model/driver'

const EMPTY: DriverDraft = {
  fullName: '',
  phone: null,
  ownTrucks: [{ plate: '', make: null, model: null }],
  autoparkId: null,
  autoparkTruck: null,
  comment: null,
  status: 'active',
}

/**
 * Adding an owner-driver at the counter.
 *
 * A man can turn up having never used the app, and the sale should not wait on
 * somebody opening the Drivers screen in another tab. So this asks for the
 * least that makes him a customer — a name and a truck — and hands him
 * straight back to the sale.
 *
 * **Owner-drivers only.** Somebody claiming to drive for an autopark is
 * claiming a discount on that company's contract, and that is not a thing to
 * take on trust at a counter: those are added by whoever manages the account.
 */
export function NewDriverModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (driver: Driver) => void
}) {
  const actions = useDriverActions()
  const [draft, setDraft] = useState<DriverDraft>(EMPTY)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(EMPTY)
      setShowErrors(false)
    }
  }, [open])

  const parsed = driverSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}
  const truck = draft.ownTrucks[0] ?? EMPTY.ownTrucks[0]!

  const setTruck = (patch: Partial<DriverDraft['ownTrucks'][number]>) =>
    setDraft((c) => ({ ...c, ownTrucks: [{ ...truck, ...patch }] }))

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) {
      toast.error('Check the highlighted fields')
      return
    }
    const created = actions.create(parsed.data)
    toast.success(`${created.fullName} added`)
    onCreated(created)
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New owner-driver"
      description="Enough to sell to him now. The rest can be filled in later on his card."
      primary={{ label: 'Add and select', onClick: save }}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required error={errors.fullName?.[0]}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                placeholder="Bekzod Normatov"
                value={draft.fullName}
                onChange={(event) => setDraft((c) => ({ ...c, fullName: event.target.value }))}
              />
            )}
          </Field>
          <Field label="Phone">
            {(p) => (
              <Input
                {...p}
                placeholder="+998 90 123 45 67"
                value={draft.phone ?? ''}
                onChange={(event) => setDraft((c) => ({ ...c, phone: event.target.value || null }))}
              />
            )}
          </Field>
        </div>

        <div className="border-border rounded-card space-y-3 border p-3">
          <p className="text-fg text-sm font-medium">His truck</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Number plate" required error={errors.ownTrucks?.[0]}>
              {(p) => (
                <Input
                  {...p}
                  placeholder="40 E 678 HH"
                  value={truck.plate}
                  onChange={(event) => setTruck({ plate: event.target.value })}
                />
              )}
            </Field>
            <Field label="Make">
              {(p) => (
                <Input
                  {...p}
                  placeholder="Scania"
                  value={truck.make ?? ''}
                  onChange={(event) => setTruck({ make: event.target.value || null })}
                />
              )}
            </Field>
            <Field label="Model">
              {(p) => (
                <Input
                  {...p}
                  placeholder="R450"
                  value={truck.model ?? ''}
                  onChange={(event) => setTruck({ model: event.target.value || null })}
                />
              )}
            </Field>
          </div>
          {/* He can own more than one, but not at a counter with a queue
              behind him — the second lorry goes on his card afterwards. */}
          <p className="text-fg-subtle text-2xs">
            One truck now. Add any others on his card later.
          </p>
        </div>
      </div>
    </Modal>
  )
}
