import { useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { toast } from '@/shared/ui/toast'
import { useDataStore } from '@/data/store'
import { useCashRegisters, useShiftActions } from '../api/shifts'
import { openShiftFor, openShiftSchema, type OpenShiftDraft } from '../model/shift'
import { t } from '@/shared/i18n'

const EMPTY: OpenShiftDraft = { registerId: '', employeeId: '', openingFloat: 200_000 }

/** Opening a drawer: which one, who is answerable, and what is in it. */
export function OpenShiftModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: registers } = useCashRegisters()
  const employees = useDataStore((s) => s.employees)
  const shifts = useDataStore((s) => s.cashShifts)
  const actions = useShiftActions()

  const [draft, setDraft] = useState<OpenShiftDraft>(EMPTY)
  const [showErrors, setShowErrors] = useState(false)

  const parsed = openShiftSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const busy = registers
    .filter((register) => register.active)
    .map((register) => ({
      register,
      taken: shifts.find((shift) => shift.status === 'open' && shift.registerId === register.id),
    }))

  const submit = () => {
    setShowErrors(true)
    if (!parsed.success) return
    const result = actions.open(parsed.data)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${result.shift.number} open`)
    setDraft(EMPTY)
    setShowErrors(false)
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('Open a shift')}
      description={t('Until a drawer is open, a cash sale cannot be taken at that location.')}
      primary={{ label: t('Open the drawer'), onClick: submit }}
    >
      <div className="space-y-3">
        <Field label={t('Register')} required error={errors.registerId?.[0]}>
          {(p) => (
            <Select
              {...p}
              className="w-full"
              placeholder={t('Choose a register')}
              value={draft.registerId || undefined}
              onChange={(registerId) => setDraft((c) => ({ ...c, registerId }))}
              // A register somebody already has open is shown and disabled,
              // with the reason — more useful than quietly omitting it.
              options={busy.map(({ register, taken }) => ({
                value: register.id,
                label: register.name,
                hint: taken ? `${taken.employeeName} has it open` : register.locationName,
                disabled: Boolean(taken),
              }))}
            />
          )}
        </Field>

        <Field label={t('Who is answerable')} required error={errors.employeeId?.[0]}>
          {(p) => (
            <Select
              {...p}
              className="w-full"
              placeholder={t('Choose a person')}
              value={draft.employeeId || undefined}
              onChange={(employeeId) => setDraft((c) => ({ ...c, employeeId }))}
              options={employees
                .filter((employee) => employee.status === 'active')
                .map((employee) => ({
                  value: employee.id,
                  label: employee.fullName,
                  hint: employee.roleName,
                }))}
            />
          )}
        </Field>

        <Field
          label={t('Opening float')}
          hint={t('The cash already in the drawer, for giving change')}
          error={errors.openingFloat?.[0]}
        >
          {(p) => (
            <NumberField
              {...p}
              className="w-full"
              nullable={false}
              value={draft.openingFloat}
              onChange={(openingFloat) =>
                setDraft((c) => ({ ...c, openingFloat: openingFloat ?? 0 }))
              }
            />
          )}
        </Field>

        {openShiftFor(shifts, registers.find((r) => r.id === draft.registerId)?.locationId ?? '') &&
        draft.registerId ? (
          <p className="text-fg-muted text-2xs">
            {t(
              'Another drawer is already open at this location. That is allowed — cash sales there will be attributed to whichever opened first.',
            )}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
