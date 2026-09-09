import { useMemo } from 'react'
import { cn } from '@/shared/lib/cn'
import { TEMPLATE_FIELDS, type PrintTemplate } from '../model/template'

/** Same string in, same pattern out — a preview that flickers looks broken. */
function hash(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A drawn barcode, not a real one.
 *
 * This build has no encoder and printing is out of scope, so the honest thing
 * is a placeholder that is *obviously* to scale and obviously not scannable —
 * it shows how much room the code takes, which is the only question the
 * preview needs to answer.
 */
function Barcode({ seed, height }: { seed: string; height: number }) {
  const bars = useMemo(() => {
    const next = hash(seed)
    return Array.from({ length: 42 }, () => (next() > 0.5 ? 2 : 1))
  }, [seed])

  return (
    <div className="flex items-end gap-px" style={{ height }} aria-hidden>
      {bars.map((weight, index) => (
        <span
          key={index}
          className={index % 2 === 0 ? 'bg-neutral-950' : 'bg-transparent'}
          style={{ width: weight, height: '100%' }}
        />
      ))}
    </div>
  )
}

function QrCode({ seed, size }: { seed: string; size: number }) {
  const cells = useMemo(() => {
    const next = hash(seed)
    const grid = 21
    return Array.from({ length: grid * grid }, (_, index) => {
      const x = index % grid
      const y = Math.floor(index / grid)
      // The three finder squares, so it reads as a QR code at a glance.
      const finder = (fx: number, fy: number) =>
        x >= fx && x < fx + 7 && y >= fy && y < fy + 7
          ? x === fx ||
            x === fx + 6 ||
            y === fy ||
            y === fy + 6 ||
            (x >= fx + 2 && x <= fx + 4 && y >= fy + 2 && y <= fy + 4)
          : null
      const corner = finder(0, 0) ?? finder(grid - 7, 0) ?? finder(0, grid - 7)
      return corner ?? next() > 0.55
    })
  }, [seed])

  return (
    <div
      className="grid"
      style={{ width: size, height: size, gridTemplateColumns: 'repeat(21, 1fr)' }}
      aria-hidden
    >
      {cells.map((on, index) => (
        <span key={index} className={on ? 'bg-neutral-950' : 'bg-transparent'} />
      ))}
    </div>
  )
}

/**
 * The scale that fits a label of any size into a fixed box, so a 40 mm sticker
 * and a 150 mm receipt sit in cards of the same height without either being
 * drawn out of proportion.
 */
export const fitScale = (widthMm: number, heightMm: number, boxW: number, boxH: number) =>
  Math.min(boxW / widthMm, boxH / heightMm)

export interface PreviewValues {
  [key: string]: string | undefined
}

/**
 * One template, drawn at true scale.
 *
 * `mmToPx` is the whole point: a label is a physical object, and the only
 * question a preview must answer honestly is whether five fields fit on 58 mm.
 * Everything is sized from millimetres so the answer on screen is the answer
 * on the sticker.
 */
export function TemplatePreview({
  template,
  values,
  mmToPx = 3.2,
  className,
}: {
  template: PrintTemplate
  /** Real product values. Falls back to the field's sample text. */
  values?: PreviewValues
  mmToPx?: number
  className?: string
}) {
  const width = template.widthMm * mmToPx
  const height = template.heightMm * mmToPx
  const seed = values?.sku ?? template.id

  const text = (key: string) =>
    values?.[key] ?? TEMPLATE_FIELDS.find((field) => field.key === key)?.sample ?? ''

  const headline = template.headlineField
  const rest = template.fields.filter((field) => field !== headline)
  const codeSize = Math.min(height * 0.34, width * 0.34)

  return (
    <div
      className={cn(
        // Paper is white and ink is black in both themes. A label that goes
        // dark with the UI is showing something that will never be printed.
        'flex flex-col justify-between overflow-hidden border border-neutral-300 bg-white text-neutral-950',
        className,
      )}
      style={{
        width,
        height,
        padding: 2 * mmToPx,
        // Scales with the label: 3 mm of cap height reads the same at any size.
        fontSize: Math.max(5, 2.4 * mmToPx),
        lineHeight: 1.25,
      }}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        {headline && template.fields.includes(headline) ? (
          <p
            className="truncate font-semibold"
            style={{ fontSize: Math.max(7, 4 * mmToPx), marginBottom: mmToPx }}
          >
            {text(headline)}
          </p>
        ) : null}
        {rest.map((field) => (
          <p key={field} className="truncate">
            {text(field)}
          </p>
        ))}
      </div>

      {template.code === 'barcode' ? (
        <div className="mt-auto">
          <Barcode seed={seed} height={Math.min(height * 0.22, 8 * mmToPx)} />
          <p className="text-center" style={{ fontSize: Math.max(4, 1.8 * mmToPx) }}>
            {text('sku')}
          </p>
        </div>
      ) : null}
      {template.code === 'qr' ? (
        <div className="mt-auto flex justify-end">
          <QrCode seed={seed} size={codeSize} />
        </div>
      ) : null}
    </div>
  )
}
