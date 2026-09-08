import { USD_RATE } from '@/data/seed'
import type { useDataStore } from '@/data/store'
import type { SourceRow, ReportSource } from '../model/report'

type State = ReturnType<typeof useDataStore.getState>

const day = (iso: string) => iso.slice(0, 10)
const month = (iso: string) => iso.slice(0, 7)

const costUzs = (price: number, currency: 'USD' | 'UZS') =>
  currency === 'USD' ? price * USD_RATE : price

/**
 * Flattens the store into report rows.
 *
 * One function per source, all returning the same shape, so the grouping code
 * never has to know where a row came from. **Cost is today's cost**, as it is
 * everywhere else in this build — a sale line records what it sold for but not
 * what it cost, so margin here is an estimate good enough to compare periods
 * and not good enough for an accountant.
 */
export function buildSourceRows(state: State, source: ReportSource): SourceRow[] {
  switch (source) {
    case 'sales':
      return salesRows(state)
    case 'stock':
      return stockRows(state)
    case 'movement':
      return movementRows(state)
    case 'money':
      return moneyRows(state)
  }
}

/** One row per sale *line*, so a report can group by product or by sale alike. */
function salesRows(state: State): SourceRow[] {
  const variations = new Map(state.variations.map((variation) => [variation.id, variation]))
  const rows: SourceRow[] = []

  for (const sale of state.sales) {
    // Deleted sales are excluded everywhere in this app; a report that counted
    // them would disagree with every other screen.
    if (sale.status === 'deleted') continue

    for (const line of sale.lines) {
      const variation = variations.get(line.variationId)
      const gross = line.quantity * line.unitPrice
      const discount = (gross * line.discountPercent) / 100
      const revenue = gross - discount
      const cost = variation
        ? costUzs(variation.costPrice, variation.costCurrency) * line.quantity
        : 0

      rows.push({
        at: sale.createdAt,
        dims: {
          date: day(sale.createdAt),
          month: month(sale.createdAt),
          product: line.name,
          category: line.categoryName ?? '—',
          brand: line.brandName ?? '—',
          client: sale.clientName ?? 'Walk-in',
          seller: sale.sellerName,
          location: sale.locationName,
          paymentMethod: sale.paymentMethod,
          channel: sale.channel,
          status: sale.status,
        },
        values: {
          revenue,
          cost,
          margin: revenue - cost,
          discount,
          units: line.quantity,
          // A sale spans several lines; counting it on each would multiply it.
          // The first line carries the sale, the rest carry zero.
          sales: line.id === sale.lines[0]?.id ? 1 : 0,
        },
      })
    }
  }
  return rows
}

/** One row per variation per location — stock is a "right now" question. */
function stockRows(state: State): SourceRow[] {
  const supplierOf = lastSupplierByVariation(state)
  const rows: SourceRow[] = []

  for (const variation of state.variations) {
    if (variation.status !== 'active') continue
    const cost = costUzs(variation.costPrice, variation.costCurrency)

    for (const at of variation.stockByLocation) {
      rows.push({
        at: null,
        dims: {
          product: variation.fullName,
          category: variation.categoryName,
          brand: variation.brandName ?? '—',
          location: at.locationName,
          supplier: supplierOf.get(variation.id) ?? 'Never delivered',
        },
        values: {
          onHand: at.quantity,
          costValue: at.quantity * cost,
          retailValue: at.quantity * variation.salePrice,
          skus: 1,
        },
      })
    }
  }
  return rows
}

/** Every document that moved stock, in one ledger. */
function movementRows(state: State): SourceRow[] {
  const variations = new Map(state.variations.map((variation) => [variation.id, variation]))
  const rows: SourceRow[] = []

  const push = (
    at: string,
    kind: string,
    locationName: string,
    variationId: string,
    name: string,
    inUnits: number,
    outUnits: number,
    first: boolean,
  ) => {
    const variation = variations.get(variationId)
    rows.push({
      at,
      dims: {
        date: day(at),
        month: month(at),
        kind,
        product: name,
        category: variation?.categoryName ?? '—',
        location: locationName,
      },
      values: { inUnits, outUnits, documents: first ? 1 : 0 },
    })
  }

  for (const receipt of state.receipts) {
    if (receipt.status !== 'received' || !receipt.receivedAt) continue
    receipt.lines.forEach((line, index) =>
      push(
        receipt.receivedAt!,
        'Goods receipt',
        receipt.locationName,
        line.variationId,
        line.name,
        line.receivedQuantity ?? line.orderedQuantity,
        0,
        index === 0,
      ),
    )
  }

  for (const transfer of state.transfers) {
    if (transfer.status !== 'received') continue
    transfer.lines.forEach((line, index) => {
      // What the far end counted is the truth; a short delivery must not show
      // as if the full amount arrived.
      const moved = line.receivedQuantity ?? line.sentQuantity ?? line.requestedQuantity
      // A transfer is two movements, not one: it leaves somewhere and arrives
      // somewhere else, and a report grouped by location must see both.
      push(
        transfer.createdAt,
        'Transfer',
        transfer.fromLocationName,
        line.variationId,
        line.name,
        0,
        moved,
        index === 0,
      )
      push(
        transfer.createdAt,
        'Transfer',
        transfer.toLocationName,
        line.variationId,
        line.name,
        moved,
        0,
        false,
      )
    })
  }

  for (const correction of state.corrections) {
    correction.lines.forEach((line, index) =>
      push(
        correction.createdAt,
        'Correction',
        correction.locationName,
        line.variationId,
        line.name,
        Math.max(0, line.countedAfter - line.countedBefore),
        Math.max(0, line.countedBefore - line.countedAfter),
        index === 0,
      ),
    )
  }

  for (const sale of state.sales) {
    if (sale.status === 'deleted') continue
    sale.lines.forEach((line, index) =>
      push(
        sale.createdAt,
        'Sale',
        sale.locationName,
        line.variationId,
        line.name,
        0,
        line.quantity,
        index === 0,
      ),
    )
  }

  return rows
}

/** Who owes whom, in one place. */
function moneyRows(state: State): SourceRow[] {
  const rows: SourceRow[] = []

  for (const client of state.clients) {
    if (client.debt <= 0) continue
    rows.push({
      at: null,
      dims: { party: client.name, partyType: 'Client' },
      values: { owedToUs: client.debt, owedByUs: 0 },
    })
  }

  for (const supplier of state.suppliers) {
    if (supplier.debt <= 0) continue
    rows.push({
      at: null,
      dims: { party: supplier.name, partyType: 'Supplier' },
      values: { owedToUs: 0, owedByUs: supplier.debt },
    })
  }

  return rows
}

/**
 * Who last delivered each variation. Inferred from receipts, as everywhere
 * else — a product does not store its supplier.
 */
function lastSupplierByVariation(state: State) {
  const latest = new Map<string, { name: string; at: string }>()
  for (const receipt of state.receipts) {
    if (receipt.status !== 'received' || !receipt.receivedAt || !receipt.supplierName) continue
    for (const line of receipt.lines) {
      const current = latest.get(line.variationId)
      if (!current || receipt.receivedAt > current.at) {
        latest.set(line.variationId, { name: receipt.supplierName, at: receipt.receivedAt })
      }
    }
  }
  return new Map([...latest].map(([id, entry]) => [id, entry.name]))
}
