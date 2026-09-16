/**
 * Reading a spreadsheet a supplier sent, in the browser, with no dependency.
 *
 * `.xlsx` is a ZIP of XML, and both halves of that are things the platform can
 * already do: `DecompressionStream` inflates the entries and `DOMParser` reads
 * them. The obvious alternative — SheetJS — is published on npm only as a
 * version with known advisories against it, and pulling that in to parse a
 * price list is a poor trade for a file the user chose themselves.
 *
 * `.csv` is handled too, because half of what people call an Excel file is one.
 */

/** A sheet as a grid of trimmed strings. Ragged rows are padded by the caller. */
export type Grid = string[][]

/* --- CSV ----------------------------------------------------------------- */

/**
 * Splits CSV, honouring quotes.
 *
 * Product names contain commas ("Filter, oil, HD"), and a naive split on comma
 * turns one column into three and silently shifts every column after it — the
 * kind of wrong that looks like a mapping mistake rather than a parsing one.
 */
export function parseCsv(text: string, delimiter = ','): Grid {
  const rows: Grid = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!

    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted cell is a literal quote.
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += char
      continue
    }

    if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      // Either line ending, and \r\n counts once.
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
    .map((cells) => cells.map((value) => value.trim()))
    .filter((cells) => cells.some(Boolean))
}

/**
 * Which delimiter the file actually uses.
 *
 * A Russian or Uzbek Windows locale writes CSV with semicolons, because the
 * comma is the decimal separator there. Guessing wrong puts the whole row in
 * one column, so it is worth counting rather than assuming.
 */
export function sniffDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const count = (d: string) => line.split(d).length
  return count(';') > count(',') ? ';' : count('\t') > count(',') ? '\t' : ','
}

/* --- XLSX ---------------------------------------------------------------- */

/** "AB12" → 27. The letters are base-26 with no zero, which is the catch. */
export function columnIndex(ref: string): number {
  let index = 0
  for (const char of ref) {
    const code = char.charCodeAt(0)
    if (code < 65 || code > 90) break
    index = index * 26 + (code - 64)
  }
  return index - 1
}

/**
 * One worksheet's XML into a grid.
 *
 * Cells are placed by their own `r="B4"` reference rather than by counting, so
 * a sheet that omits empty cells — which Excel does — does not shift every
 * value after the gap one column to the left.
 */
export function parseSheetXml(xml: string, sharedStrings: string[]): Grid {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const grid: Grid = []

  for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = []
    for (const cellEl of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = cellEl.getAttribute('r') ?? ''
      const at = ref ? columnIndex(ref) : cells.length
      const type = cellEl.getAttribute('t')

      let value = ''
      if (type === 's') {
        const index = Number(cellEl.getElementsByTagName('v')[0]?.textContent ?? '')
        value = sharedStrings[index] ?? ''
      } else if (type === 'inlineStr') {
        value = Array.from(cellEl.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '')
          .join('')
      } else {
        value = cellEl.getElementsByTagName('v')[0]?.textContent ?? ''
      }

      while (cells.length < at) cells.push('')
      cells[at] = value.trim()
    }
    grid.push(cells)
  }

  return grid.filter((cells) => cells.some(Boolean))
}

/** The shared string table, which is where every text cell's value actually lives. */
export function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('si')).map((si) =>
    // A run-formatted string is several <t> fragments; joined, it is the value.
    Array.from(si.getElementsByTagName('t'))
      .map((t) => t.textContent ?? '')
      .join(''),
  )
}

/* --- the ZIP the xlsx is ------------------------------------------------- */

const view = (buffer: ArrayBuffer) => new DataView(buffer)

async function inflate(bytes: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return bytes
  if (method !== 8) throw new Error(`This file uses a compression we cannot read (${method})`)
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    // Raw deflate: the zip entry carries no zlib header.
    new DecompressionStream('deflate-raw'),
  )
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * The entries of a ZIP, read from its central directory.
 *
 * Scanning local headers instead would be shorter and wrong: a file written by
 * a streaming writer leaves the sizes in the local header at zero and puts the
 * real ones in a data descriptor afterwards. The central directory always has
 * them.
 */
export async function unzip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const data = view(buffer)
  const bytes = new Uint8Array(buffer)

  // The end-of-central-directory record is last, after a comment of unknown
  // length, so it has to be found by scanning back for its signature.
  let eocd = -1
  for (let i = buffer.byteLength - 22; i >= 0 && i > buffer.byteLength - 66_000; i--) {
    if (data.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('That does not look like a spreadsheet')

  const count = data.getUint16(eocd + 10, true)
  let at = data.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()

  for (let i = 0; i < count; i++) {
    if (data.getUint32(at, true) !== 0x02014b50) break
    const method = data.getUint16(at + 10, true)
    const compressedSize = data.getUint32(at + 20, true)
    const nameLength = data.getUint16(at + 28, true)
    const extraLength = data.getUint16(at + 30, true)
    const commentLength = data.getUint16(at + 32, true)
    const localAt = data.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))

    // The local header's own name and extra fields sit before the data, and
    // its extra length can differ from the central one.
    const localNameLength = data.getUint16(localAt + 26, true)
    const localExtraLength = data.getUint16(localAt + 28, true)
    const start = localAt + 30 + localNameLength + localExtraLength

    files.set(name, await inflate(bytes.subarray(start, start + compressedSize), method))
    at += 46 + nameLength + extraLength + commentLength
  }

  return files
}

/* --- the one function screens call --------------------------------------- */

/** Reads the first sheet of an .xlsx, or the whole of a .csv, as a grid. */
export async function readSpreadsheet(file: File): Promise<Grid> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    const body = await file.text()
    return parseCsv(body, sniffDelimiter(body))
  }

  const files = await unzip(await file.arrayBuffer())
  const decode = (name: string) => {
    const bytes = files.get(name)
    return bytes ? new TextDecoder().decode(bytes) : ''
  }

  const sheetName = [...files.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()[0]
  if (!sheetName) throw new Error('That spreadsheet has no sheets we can read')

  return parseSheetXml(decode(sheetName), parseSharedStrings(decode('xl/sharedStrings.xml')))
}
