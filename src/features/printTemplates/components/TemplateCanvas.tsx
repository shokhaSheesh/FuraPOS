import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Minus,
  QrCode as QrIcon,
  Square,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Barcode as BarcodeIcon,
  Circle as CircleIcon,
} from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'
import {
  ELEMENT_DEFAULTS,
  fieldsFor,
  type ElementKind,
  type TemplateElement,
  type TemplateKind,
} from '../model/template'
import { Barcode, QrCode, sampleFor } from './TemplatePreview'

/** How big a millimetre is on screen while designing. Print is unaffected. */
const MM = 4

/** What a newly dropped element is, before it is dragged anywhere. */
const SIZES: Record<ElementKind, { widthMm: number; heightMm: number }> = {
  field: { widthMm: 30, heightMm: 6 },
  text: { widthMm: 30, heightMm: 6 },
  barcode: { widthMm: 34, heightMm: 12 },
  qr: { widthMm: 16, heightMm: 16 },
  line: { widthMm: 30, heightMm: 0.4 },
  rect: { widthMm: 24, heightMm: 14 },
  circle: { widthMm: 14, heightMm: 14 },
}

let nextId = 1
const newId = () => `el-${Date.now().toString(36)}-${nextId++}`

/**
 * The template designer (client request: as OX does it).
 *
 * Everything on a label is placed by hand — dragged where it goes, pulled to
 * the size it should be — because a sticker is a physical object and the only
 * layout that matters is the one that fits. The canvas is the label at true
 * scale; a millimetre here is a millimetre on the roll.
 */
export function TemplateCanvas({
  kind,
  widthMm,
  heightMm,
  elements,
  onChange,
}: {
  kind: TemplateKind
  widthMm: number
  heightMm: number
  elements: TemplateElement[]
  onChange: (elements: TemplateElement[]) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const selected = elements.find((element) => element.id === selectedId) ?? null

  const add = (kindOfElement: ElementKind, field?: string) => {
    const size = SIZES[kindOfElement]
    const element: TemplateElement = {
      id: newId(),
      kind: kindOfElement,
      field,
      text: kindOfElement === 'text' ? t('Text') : undefined,
      // Dropped at the top left, out of the way of whatever is already there.
      xMm: 3,
      yMm: Math.min(heightMm - size.heightMm - 2, 3 + elements.length * 2),
      ...size,
      ...ELEMENT_DEFAULTS,
    }
    onChange([...elements, element])
    setSelectedId(element.id)
  }

  const patch = (id: string, next: Partial<TemplateElement>) =>
    onChange(elements.map((element) => (element.id === id ? { ...element, ...next } : element)))

  const remove = (id: string) => {
    onChange(elements.filter((element) => element.id !== id))
    setSelectedId(null)
  }

  /** Dragging the body moves it; dragging the corner resizes it. */
  const startDrag = (
    event: ReactPointerEvent,
    element: TemplateElement,
    mode: 'move' | 'resize',
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(element.id)
    const startX = event.clientX
    const startY = event.clientY
    const from = { ...element }
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)

    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / MM
      const dy = (moveEvent.clientY - startY) / MM
      if (mode === 'move') {
        patch(element.id, {
          xMm: Math.max(0, Math.min(widthMm - from.widthMm, Math.round((from.xMm + dx) * 2) / 2)),
          yMm: Math.max(0, Math.min(heightMm - from.heightMm, Math.round((from.yMm + dy) * 2) / 2)),
        })
      } else {
        patch(element.id, {
          widthMm: Math.max(
            2,
            Math.min(widthMm - from.xMm, Math.round((from.widthMm + dx) * 2) / 2),
          ),
          heightMm: Math.max(
            0.4,
            Math.min(heightMm - from.yMm, Math.round((from.heightMm + dy) * 2) / 2),
          ),
        })
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const shapes: { kind: ElementKind; label: string; icon: typeof Type }[] = [
    { kind: 'text', label: t('Text'), icon: Type },
    { kind: 'barcode', label: t('Barcode'), icon: BarcodeIcon },
    { kind: 'qr', label: t('QR code'), icon: QrIcon },
    { kind: 'line', label: t('Line'), icon: Minus },
    { kind: 'rect', label: t('Rectangle'), icon: Square },
    { kind: 'circle', label: t('Circle'), icon: CircleIcon },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-3">
        {/* What the selected element looks like. Nothing selected, nothing to set. */}
        <div className="border-border bg-surface rounded-control flex min-h-11 flex-wrap items-center gap-1.5 border p-1.5">
          {selected ? (
            <>
              <Input
                type="number"
                min={4}
                max={72}
                aria-label={t('Text size')}
                className="h-8 w-16"
                value={selected.fontPt}
                onChange={(event) =>
                  patch(selected.id, {
                    fontPt: Number(event.target.value) || ELEMENT_DEFAULTS.fontPt,
                  })
                }
              />
              <input
                type="color"
                aria-label={t('Colour')}
                className="border-border h-8 w-10 cursor-pointer rounded border bg-transparent"
                value={selected.color}
                onChange={(event) => patch(selected.id, { color: event.target.value })}
              />
              {(
                [
                  { key: 'bold', icon: Bold, label: t('Bold') },
                  { key: 'italic', icon: Italic, label: t('Italic') },
                  { key: 'underline', icon: Underline, label: t('Underline') },
                  { key: 'strike', icon: Strikethrough, label: t('Strikethrough') },
                ] as const
              ).map((toggle) => (
                <Button
                  key={toggle.key}
                  type="button"
                  variant={selected[toggle.key] ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8"
                  aria-label={toggle.label}
                  aria-pressed={selected[toggle.key]}
                  onClick={() => patch(selected.id, { [toggle.key]: !selected[toggle.key] })}
                >
                  <toggle.icon />
                </Button>
              ))}
              {(
                [
                  { value: 'left', icon: AlignLeft, label: t('Align left') },
                  { value: 'center', icon: AlignCenter, label: t('Align centre') },
                  { value: 'right', icon: AlignRight, label: t('Align right') },
                ] as const
              ).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={selected.align === option.value ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8"
                  aria-label={option.label}
                  aria-pressed={selected.align === option.value}
                  onClick={() => patch(selected.id, { align: option.value })}
                >
                  <option.icon />
                </Button>
              ))}
              {selected.kind === 'text' ? (
                <Input
                  aria-label={t('Text')}
                  className="h-8 w-40"
                  value={selected.text ?? ''}
                  onChange={(event) => patch(selected.id, { text: event.target.value })}
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hover:text-danger ml-auto size-8"
                aria-label={t('Delete')}
                onClick={() => remove(selected.id)}
              >
                <Trash2 />
              </Button>
            </>
          ) : (
            <p className="text-fg-subtle px-1.5 text-sm">
              {t('Pick something on the label to change how it looks.')}
            </p>
          )}
        </div>

        {/* The label itself, at true size. */}
        <div className="bg-canvas rounded-card flex justify-center overflow-auto p-6">
          <div
            ref={sheet}
            onPointerDown={() => setSelectedId(null)}
            className="relative shrink-0 border border-neutral-300 bg-white text-neutral-950"
            style={{ width: widthMm * MM, height: heightMm * MM }}
          >
            {elements.map((element) => (
              <div
                key={element.id}
                onPointerDown={(event) => startDrag(event, element, 'move')}
                className={cn(
                  'absolute cursor-move',
                  element.id === selectedId
                    ? 'outline-primary outline-2 outline-dashed'
                    : 'hover:outline-border-strong hover:outline hover:outline-dashed',
                )}
                style={{
                  left: element.xMm * MM,
                  top: element.yMm * MM,
                  width: element.widthMm * MM,
                  height: element.heightMm * MM,
                }}
              >
                <ElementBody element={element} />
                {element.id === selectedId ? (
                  <span
                    onPointerDown={(event) => startDrag(event, element, 'resize')}
                    className="bg-primary absolute -right-1 -bottom-1 size-2.5 cursor-nwse-resize rounded-full"
                  />
                ) : null}
              </div>
            ))}
            {elements.length === 0 ? (
              <p className="text-fg-subtle absolute inset-0 flex items-center justify-center p-3 text-center text-xs">
                {t('Add a field or a shape from the right, then drag it where it goes.')}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* What can be put on it. */}
      <div className="space-y-4">
        <div>
          <p className="text-fg-subtle text-2xs mb-1.5">{t('Product')}</p>
          <div className="flex flex-wrap gap-1.5">
            {fieldsFor(kind).map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => add('field', field.key)}
                className="border-border hover:border-primary hover:bg-primary-soft/50 rounded-control text-fg border px-2 py-1.5 text-xs transition-colors"
              >
                {t(field.label)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-fg-subtle text-2xs mb-1.5">{t('Media')}</p>
          <div className="flex flex-wrap gap-1.5">
            {shapes.map((shape) => (
              <button
                key={shape.kind}
                type="button"
                onClick={() => add(shape.kind)}
                className="border-border hover:border-primary hover:bg-primary-soft/50 rounded-control text-fg flex items-center gap-1.5 border px-2 py-1.5 text-xs transition-colors [&_svg]:size-3.5"
              >
                <shape.icon />
                {shape.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** What an element draws — the same thing the printed sheet will show. */
export function ElementBody({
  element,
  values,
  mmToPx = MM,
}: {
  element: TemplateElement
  values?: Record<string, string | undefined>
  mmToPx?: number
}) {
  if (element.kind === 'line') {
    return <div className="size-full" style={{ backgroundColor: element.color }} />
  }
  if (element.kind === 'rect' || element.kind === 'circle') {
    return (
      <div
        className={cn('size-full border', element.kind === 'circle' && 'rounded-full')}
        style={{ borderColor: element.color }}
      />
    )
  }
  if (element.kind === 'barcode') {
    return (
      <Barcode
        seed={values?.sku ?? element.id}
        height={element.heightMm * mmToPx}
        className="w-full"
      />
    )
  }
  if (element.kind === 'qr') {
    return <QrCode seed={values?.sku ?? element.id} size={element.heightMm * mmToPx} />
  }

  const text =
    element.kind === 'text'
      ? (element.text ?? '')
      : (values?.[element.field ?? ''] ?? sampleFor(element.field ?? ''))

  return (
    <p
      className="size-full overflow-hidden"
      style={{
        color: element.color,
        // Points to millimetres: a 9 pt line is 3.18 mm tall.
        fontSize: (element.fontPt / 72) * 25.4 * mmToPx,
        fontWeight: element.bold ? 600 : 400,
        fontStyle: element.italic ? 'italic' : undefined,
        textDecoration:
          [element.underline ? 'underline' : '', element.strike ? 'line-through' : '']
            .filter(Boolean)
            .join(' ') || undefined,
        textAlign: element.align,
        lineHeight: 1.15,
      }}
    >
      {text}
    </p>
  )
}
