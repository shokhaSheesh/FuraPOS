/**
 * A table sent to the browser's print dialog, where "Save as PDF" is one click
 * (client request: every export offers a spreadsheet and a PDF).
 *
 * Built as plain DOM rather than a React portal so a row action can call it
 * without a component of its own, and torn down again afterwards — the print
 * stylesheet shows `.print-sheet` and hides everything else, so one left
 * behind would print on top of the next thing.
 */
export function printSheet({
  title,
  head,
  rows,
}: {
  title: string
  head: string[]
  rows: (string | number | null | undefined)[][]
}): void {
  const sheet = document.createElement('div')
  sheet.className = 'print-sheet'
  // Off screen until the dialog reads it.
  sheet.style.display = 'none'

  const escape = (value: string | number | null | undefined) =>
    String(value ?? '').replace(
      /[&<>]/g,
      (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character] ?? character,
    )

  sheet.innerHTML = `
    <h1 style="font-size:14px;font-weight:700;margin:0 0 8px">${escape(title)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead><tr>${head
        .map(
          (cell) =>
            `<th style="text-align:left;padding:3px 6px 3px 0;border-top:1px solid #000;border-bottom:1px solid #000">${escape(cell)}</th>`,
        )
        .join('')}</tr></thead>
      <tbody>${rows
        .map(
          (row) =>
            `<tr style="break-inside:avoid">${row
              .map(
                (cell) =>
                  `<td style="padding:3px 6px 3px 0;border-bottom:1px solid #d4d4d4;vertical-align:top">${escape(cell)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')}</tbody>
    </table>`

  document.body.append(sheet)
  // The print stylesheet turns it back on; on screen it never appears.
  sheet.style.display = ''
  sheet.style.visibility = 'hidden'
  try {
    window.print()
  } finally {
    sheet.remove()
  }
}
