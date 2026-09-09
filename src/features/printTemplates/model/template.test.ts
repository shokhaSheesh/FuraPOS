import { describe, expect, it } from 'vitest'
import {
  describeTemplate,
  perColumn,
  perSheet,
  plural,
  fieldsAfterKindChange,
  fieldsFor,
  perRow,
  sizeLabel,
  templateSchema,
  type PrintTemplate,
} from './template'

const template: PrintTemplate = {
  id: 't1',
  name: 'Part label',
  kind: 'label',
  widthMm: 80,
  heightMm: 50,
  code: 'barcode',
  fields: ['productName', 'sku', 'brand'],
  headlineField: 'productName',
  createdBy: 'Mansur',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

describe('fieldsFor', () => {
  it('keeps price off a part label but offers it on a shelf label', () => {
    expect(fieldsFor('label').map((f) => f.key)).not.toContain('price')
    expect(fieldsFor('shelf').map((f) => f.key)).toContain('price')
  })
})

describe('fieldsAfterKindChange', () => {
  it('drops a field the new kind cannot carry', () => {
    expect(fieldsAfterKindChange(['productName', 'price'], 'label')).toEqual(['productName'])
  })

  it('leaves everything alone when the new kind allows it', () => {
    expect(fieldsAfterKindChange(['productName', 'price'], 'shelf')).toEqual([
      'productName',
      'price',
    ])
  })

  it('keeps the order the person put them in', () => {
    expect(fieldsAfterKindChange(['sku', 'productName', 'brand'], 'label')).toEqual([
      'sku',
      'productName',
      'brand',
    ])
  })
})

describe('perRow', () => {
  it('fits two 80 mm labels across A4, not three', () => {
    expect(perRow(80)).toBe(2)
  })

  it('never returns zero, however wide the label', () => {
    expect(perRow(300)).toBe(1)
  })

  it('fits three 58 mm labels', () => {
    expect(perRow(58)).toBe(3)
  })
})

describe('perColumn and perSheet', () => {
  it('fits one 150 mm receipt down a page, not two', () => {
    expect(perColumn(150)).toBe(1)
  })

  it('fits six 40 mm stickers down a page', () => {
    expect(perColumn(40)).toBe(6)
  })

  it('multiplies rows by columns for the sheet', () => {
    // 58 mm across fits 3, 40 mm down fits 6.
    expect(perSheet(58, 40)).toBe(18)
  })

  it('never returns zero for a label bigger than the paper', () => {
    expect(perSheet(300, 400)).toBe(1)
  })
})

describe('plural', () => {
  it('says one label, not 1 labels', () => {
    expect(plural(1, 'label')).toBe('1 label')
  })

  it('pluralises everything else', () => {
    expect(plural(12, 'label')).toBe('12 labels')
    expect(plural(0, 'sheet')).toBe('0 sheets')
  })
})

describe('describeTemplate', () => {
  it('names the kind, the field count and the code', () => {
    expect(describeTemplate(template)).toBe('Product label · 3 fields · barcode')
  })

  it('says nothing about a code when there is none', () => {
    expect(describeTemplate({ ...template, code: 'none' })).toBe('Product label · 3 fields')
  })
})

describe('sizeLabel', () => {
  it('reads as millimetres', () => {
    expect(sizeLabel(template)).toBe('80 × 50 mm')
  })
})

describe('templateSchema', () => {
  it('refuses a template with no fields — it would print a blank sticker', () => {
    const result = templateSchema.safeParse({ ...template, fields: [] })
    expect(result.success).toBe(false)
  })

  it('refuses a label too small to read', () => {
    expect(templateSchema.safeParse({ ...template, widthMm: 5 }).success).toBe(false)
  })

  it('refuses one wider than the paper', () => {
    expect(templateSchema.safeParse({ ...template, widthMm: 300 }).success).toBe(false)
  })

  it('accepts a sound one', () => {
    expect(templateSchema.safeParse(template).success).toBe(true)
  })
})
