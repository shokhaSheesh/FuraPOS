import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowDown, ArrowLeft, ArrowUp, Save } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Badge } from '@/shared/ui/Badge'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { usePrintTemplate, useTemplateActions } from '../api/templates'
import {
  CODE_KINDS,
  PRESET_SIZES,
  TEMPLATE_KINDS,
  fieldsAfterKindChange,
  fieldsFor,
  perRow,
  templateSchema,
  type CodeKind,
  type TemplateDraft,
  type TemplateKind,
} from '../model/template'
import { TemplatePreview } from '../components/TemplatePreview'

const EMPTY: TemplateDraft = {
  name: '',
  kind: 'label',
  widthMm: 58,
  heightMm: 40,
  code: 'barcode',
  fields: ['productName', 'sku'],
  headlineField: 'productName',
}

/**
 * The label designer.
 *
 * OX gives you a free canvas and lets you drag every element to any x/y. This
 * asks the same questions in a form, for a reason: the hard part of a label is
 * never *where* the SKU sits, it is whether the SKU is on there at all and
 * whether the name still fits at 58 mm. Both of those are answered by the
 * preview on the right, which redraws at true scale as you tick.
 *
 * Free placement is the thing given up, and it is a real trade — a print shop
 * would want it. A parts counter wants five fields in a sensible order.
 */
export default function TemplateFormPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { data: existing } = usePrintTemplate(templateId)
  const actions = useTemplateActions()
  const editing = Boolean(templateId)

  const [draft, setDraft] = useState<TemplateDraft>(() =>
    existing
      ? {
          name: existing.name,
          kind: existing.kind,
          widthMm: existing.widthMm,
          heightMm: existing.heightMm,
          code: existing.code,
          fields: existing.fields,
          headlineField: existing.headlineField,
        }
      : EMPTY,
  )
  const [showErrors, setShowErrors] = useState(false)

  const parsed = templateSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const available = useMemo(() => fieldsFor(draft.kind), [draft.kind])

  const setKind = (kind: TemplateKind) => {
    const fields = fieldsAfterKindChange(draft.fields, kind)
    const dropped = draft.fields.length - fields.length
    // Silently printing a price on a part label would be worse than saying so.
    if (dropped > 0)
      toast.info(`${dropped} field${dropped > 1 ? 's' : ''} removed — not on a ${kind}`)
    setDraft((c) => ({
      ...c,
      kind,
      fields,
      headlineField: fields.includes(c.headlineField ?? '') ? c.headlineField : (fields[0] ?? null),
    }))
  }

  const toggleField = (key: string) =>
    setDraft((c) => {
      const on = c.fields.includes(key)
      const fields = on ? c.fields.filter((field) => field !== key) : [...c.fields, key]
      return {
        ...c,
        fields,
        headlineField:
          c.headlineField === key && on ? (fields[0] ?? null) : (c.headlineField ?? key),
      }
    })

  const move = (key: string, by: -1 | 1) =>
    setDraft((c) => {
      const index = c.fields.indexOf(key)
      const next = index + by
      if (index < 0 || next < 0 || next >= c.fields.length) return c
      const fields = [...c.fields]
      const moved = fields[index]!
      fields[index] = fields[next]!
      fields[next] = moved
      return { ...c, fields }
    })

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) {
      toast.error('Check the highlighted fields')
      return
    }
    if (editing && templateId) {
      actions.update(templateId, parsed.data)
      toast.success('Template saved')
    } else {
      actions.create(parsed.data)
      toast.success(`${parsed.data.name} created`)
    }
    navigate(paths.products.printTemplates)
  }

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.printTemplates}>
          <ArrowLeft />
          Print templates
        </Link>
      </Button>

      <PageHeader
        title={editing ? `Edit ${existing?.name ?? 'template'}` : 'New print template'}
        description="Choose the size, the code and what prints on it. The preview is drawn at true size."
        action={
          <Button variant="primary" onClick={save}>
            <Save />
            {editing ? 'Save changes' : 'Create template'}
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>The basics</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required error={errors.name?.[0]} className="sm:col-span-2">
                {(p) => (
                  <Input
                    {...p}
                    placeholder="Part sticker"
                    value={draft.name}
                    onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
                  />
                )}
              </Field>
              <Field label="What it is">
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={draft.kind}
                    onChange={(kind) => setKind(kind as TemplateKind)}
                    options={TEMPLATE_KINDS.map((kind) => ({
                      value: kind.value,
                      label: kind.label,
                      hint: kind.hint,
                    }))}
                  />
                )}
              </Field>
              <Field label="Code">
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={draft.code}
                    onChange={(code) => setDraft((c) => ({ ...c, code: code as CodeKind }))}
                    options={CODE_KINDS}
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-stretch gap-1">
              <CardTitle>Size</CardTitle>
              <p className="text-fg-subtle text-2xs">
                {perRow(draft.widthMm)} across a sheet of A4.
              </p>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SIZES.map((size) => {
                  const active = size.widthMm === draft.widthMm && size.heightMm === draft.heightMm
                  return (
                    <Button
                      key={size.label}
                      variant={active ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        setDraft((c) => ({
                          ...c,
                          widthMm: size.widthMm,
                          heightMm: size.heightMm,
                        }))
                      }
                    >
                      {size.label}
                    </Button>
                  )
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Width (mm)" error={errors.widthMm?.[0]}>
                  {(p) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      nullable={false}
                      min={20}
                      value={draft.widthMm}
                      onChange={(widthMm) => setDraft((c) => ({ ...c, widthMm: widthMm ?? 20 }))}
                    />
                  )}
                </Field>
                <Field label="Height (mm)" error={errors.heightMm?.[0]}>
                  {(p) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      nullable={false}
                      min={20}
                      value={draft.heightMm}
                      onChange={(heightMm) => setDraft((c) => ({ ...c, heightMm: heightMm ?? 20 }))}
                    />
                  )}
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex-col items-stretch gap-1">
              <CardTitle>What prints on it</CardTitle>
              <p className="text-fg-subtle text-2xs">
                Ticked fields print in this order. The headline is the one set in large type.
              </p>
            </CardHeader>
            <CardBody className="space-y-1">
              {errors.fields?.[0] ? (
                <p className="text-danger text-2xs pb-1">{errors.fields[0]}</p>
              ) : null}
              {/* Chosen fields first, in print order, so the list on screen
                  matches the label beside it. */}
              {[
                ...draft.fields
                  .map((key) => available.find((field) => field.key === key))
                  .filter((field) => field !== undefined),
                ...available.filter((field) => !draft.fields.includes(field.key)),
              ].map((field) => {
                const on = draft.fields.includes(field.key)
                const isHeadline = draft.headlineField === field.key
                return (
                  <div
                    key={field.key}
                    className="hover:bg-canvas flex items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <Checkbox
                      aria-label={field.label}
                      checked={on}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <span className={on ? 'text-fg text-sm' : 'text-fg-subtle text-sm'}>
                      {field.label}
                    </span>
                    {isHeadline ? <Badge tone="neutral">Headline</Badge> : null}
                    <div className="ml-auto flex items-center gap-1">
                      {on && !isHeadline ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDraft((c) => ({ ...c, headlineField: field.key }))}
                        >
                          Make headline
                        </Button>
                      ) : null}
                      {on ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Move ${field.label} up`}
                            onClick={() => move(field.key, -1)}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Move ${field.label} down`}
                            onClick={() => move(field.key, 1)}
                          >
                            <ArrowDown />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </CardBody>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4 lg:h-fit lg:w-80">
          <CardHeader className="flex-col items-stretch gap-1">
            <CardTitle>Preview</CardTitle>
            <p className="text-fg-subtle text-2xs">
              Drawn at true size, with sample values. If a name is cut off here, it is cut off on
              the sticker.
            </p>
          </CardHeader>
          <CardBody className="bg-canvas flex justify-center py-6">
            <TemplatePreview
              template={{
                ...draft,
                id: templateId ?? 'preview',
                createdBy: '',
                updatedAt: new Date().toISOString(),
              }}
            />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
