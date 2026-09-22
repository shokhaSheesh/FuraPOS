/**
 * Codes a product gets when nobody types one (client request).
 *
 * A part that arrives in a box with no code of its own still has to be found
 * at the till and scanned off a shelf, so leaving the SKU or the barcode empty
 * is not an option — but making somebody invent one at the counter is how two
 * products end up sharing a code. Both are therefore generated from what is
 * already in the catalogue, and both are checked against it.
 */

/** Our own SKUs read "SKU-00042", with the side appended where a part has one. */
export function generateSku(taken: Iterable<string>, side?: string | null): string {
  const used = new Set([...taken].map((code) => code.trim().toLowerCase()).filter(Boolean))
  const suffix = side ? `-${side.trim().charAt(0).toUpperCase()}` : ''
  let next = 1
  for (const code of used) {
    const found = /^sku-(\d+)/.exec(code)
    if (found) next = Math.max(next, Number(found[1]) + 1)
  }
  let sku = `SKU-${String(next).padStart(5, '0')}${suffix}`
  while (used.has(sku.toLowerCase())) {
    next += 1
    sku = `SKU-${String(next).padStart(5, '0')}${suffix}`
  }
  return sku
}

/** The check digit an EAN-13 carries in its thirteenth place. */
function eanCheckDigit(twelve: string): number {
  const sum = [...twelve].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  )
  return (10 - (sum % 10)) % 10
}

/**
 * A barcode for a part that came without one: a valid EAN-13 in the **200–299**
 * prefix, which the standard reserves for a shop's own use and no manufacturer
 * is ever issued. A real scanner reads it; nothing else in the world carries it.
 */
export function generateBarcode(taken: Iterable<string>, seed = Date.now()): string {
  const used = new Set([...taken].map((code) => code.trim()).filter(Boolean))
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const body = String((seed + attempt * 7919) % 1_000_000_000).padStart(9, '0')
    const twelve = `200${body}`
    const barcode = `${twelve}${eanCheckDigit(twelve)}`
    if (!used.has(barcode)) return barcode
  }
  // A thousand collisions in a row cannot happen with nine digits to draw from.
  return `200${String(seed).slice(-9).padStart(9, '0')}`
}
