import { DropdownMenu } from 'radix-ui'
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { downloadCsv } from '@/shared/lib/csv'
import { printSheet } from '@/shared/lib/printSheet'
import { t } from '@/shared/i18n'

/** A table, ready to leave the app. */
export interface ExportSheet {
  /** Without an extension — each format adds its own. */
  name: string
  title?: string
  head: string[]
  rows: (string | number | null | undefined)[][]
}

/**
 * Every export offers the same two (client request): a spreadsheet to work in,
 * and a PDF to send or file.
 *
 * The PDF is the browser's own — the sheet is laid out on screen and handed to
 * the print dialog, where "Save as PDF" is one click. That is how every other
 * document in the product reaches paper, and it keeps a PDF library out of a
 * build that has no backend to render one.
 */
export function ExportMenu({
  sheet,
  label = t('Export'),
  variant = 'secondary',
}: {
  sheet: () => ExportSheet
  label?: string
  variant?: 'secondary' | 'primary' | 'ghost'
}) {
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant={variant}>
            <Download />
            {label}
            <ChevronDown />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="rounded-control border-border bg-surface shadow-popover z-50 w-56 border p-1"
          >
            <DropdownMenu.Item
              onSelect={() => {
                const data = sheet()
                downloadCsv(`${data.name}.csv`, data.head, data.rows)
              }}
              className="rounded-control data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2.5 px-2 py-2 text-sm outline-none"
            >
              <FileSpreadsheet className="text-fg-muted size-4" />
              {t('Excel (CSV)')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                const data = sheet()
                printSheet({ title: data.title ?? data.name, head: data.head, rows: data.rows })
              }}
              className="rounded-control data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2.5 px-2 py-2 text-sm outline-none"
            >
              <FileText className="text-fg-muted size-4" />
              {t('PDF')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  )
}
