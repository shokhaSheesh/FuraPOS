import { Link, useParams } from 'react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { paths } from '@/shared/config/paths'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { USD_RATE } from '@/data/seed'
import { useProduct } from '../api/products'
import {
  costInUzs,
  effectivePrice,
  marginRatio,
  PART_SIDES,
  productStock,
  type Product,
  type ProductVariation,
} from '../model/product'

const Empty = () => <span className="text-fg-subtle">—</span>

/**
 * A product and its variations. The product carries what the part *is*; every
 * price, barcode and stock figure belongs to a variation, so the variations
 * table is the centre of this page rather than a footnote to it.
 */
export default function ProductDetailPage() {
  const { productId = '' } = useParams()
  const { data: product, isError } = useProduct(productId)

  if (isError || !product) {
    return (
      <Card>
        <EmptyState
          title="Product not found"
          description="It may have been removed, or the link is wrong."
          action={
            <Button variant="secondary" asChild>
              <Link to={paths.products.list}>Back to products</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  const stock = productStock(product)
  const saleValue = product.variations.reduce((sum, v) => sum + v.stock * effectivePrice(v), 0)
  const costValue = product.variations.reduce((sum, v) => sum + v.stock * costInUzs(v, USD_RATE), 0)

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.list}>
          <ArrowLeft />
          Products
        </Link>
      </Button>

      <PageHeader
        title={product.name}
        description={
          [product.categoryPath, product.description && `OEM ${product.description}`]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        action={
          <Button variant="primary" asChild>
            <Link to={paths.products.edit(product.id)}>
              <Pencil />
              Edit
            </Link>
          </Button>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={product.status === 'active' ? 'success' : 'neutral'}>
              {product.status === 'active' ? 'Active' : 'Archived'}
            </Badge>
            {product.vehicleMake ? (
              <Badge tone="info">
                {product.vehicleMake}
                {product.vehicleModels.length ? ` · ${product.vehicleModels.join(', ')}` : ''}
              </Badge>
            ) : null}
            {product.isShippable ? <Badge>Shippable</Badge> : null}
            {product.showOnline ? <Badge>Online</Badge> : null}
            {product.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Variations" value={formatNumber(product.variations.length)} />
        <Metric
          label="In stock"
          value={`${formatNumber(stock)} ${product.unit}`}
          tone={stock === 0 ? 'danger' : undefined}
        />
        <Metric label="Stock at sale" value={formatMoney(saleValue)} />
        <Metric label="Stock at cost" value={formatMoney(costValue)} />
      </div>

      <Tabs
        items={[
          {
            value: 'variations',
            label: 'Variations',
            badge: (
              <span className="bg-surface-inset text-fg-muted text-2xs rounded-full px-1.5">
                {product.variations.length}
              </span>
            ),
            content: <VariationsTable product={product} />,
          },
          { value: 'details', label: 'Details', content: <Details product={product} /> },
          { value: 'stock', label: 'Stock by location', content: <StockTable product={product} /> },
        ]}
      />
    </>
  )
}

function VariationsTable({ product }: { product: Product }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr className="text-fg-muted text-2xs tracking-wide uppercase">
              {['Variation', 'SKU', 'Barcode', 'Side', 'Shelf', 'MOQ'].map((h) => (
                <th key={h} scope="col" className="h-9 px-3 text-left font-semibold">
                  {h}
                </th>
              ))}
              {['Cost', 'Price', 'Discounted', 'Margin', 'Stock'].map((h) => (
                <th key={h} scope="col" className="h-9 px-3 text-right font-semibold">
                  {h}
                </th>
              ))}
              <th scope="col" className="h-9 px-3 text-left font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {product.variations.map((v) => (
              <tr key={v.id}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <ProductThumb src={v.imageUrl} size="sm" />
                    <span className="text-fg font-medium">{v.name}</span>
                  </div>
                </td>
                <td className="text-2xs px-3 py-2 font-mono">{v.sku}</td>
                <td className="text-2xs px-3 py-2 font-mono">{v.barcode ?? <Empty />}</td>
                <td className="px-3 py-2">
                  {PART_SIDES.find((s) => s.value === v.partSide)?.label ?? <Empty />}
                </td>
                <td className="px-3 py-2">{v.shelfAddress ?? <Empty />}</td>
                <td className="px-3 py-2">{v.moq ? formatNumber(v.moq) : <Empty />}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {v.costCurrency === 'USD'
                    ? `${formatNumber(v.costPrice)} USD`
                    : formatMoney(v.costPrice)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(v.salePrice)}</td>
                <td className="text-warning px-3 py-2 text-right tabular-nums">
                  {v.discountPrice ? formatMoney(v.discountPrice) : <Empty />}
                </td>
                <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                  {formatPercent(marginRatio(v, USD_RATE))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className={v.stock === 0 ? 'text-danger font-medium' : undefined}>
                    {formatNumber(v.stock)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={v.status === 'active' ? 'success' : 'neutral'}>
                    {v.status === 'active' ? 'Active' : 'Archived'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Details({ product }: { product: Product }) {
  const rows: [string, React.ReactNode][] = [
    ['Category', product.categoryPath],
    ['Supplier brand', product.brandName ?? <Empty />],
    ['Manufacturer', product.manufacturer ?? <Empty />],
    ['OEM number', product.description ?? <Empty />],
    ['Unit', product.unit],
    ['Vehicle make', product.vehicleMake ?? <Empty />],
    ['Vehicle models', product.vehicleModels.join(', ') || <Empty />],
    ['Cargo weight', product.cargoWeightKg ? `${product.cargoWeightKg} kg` : <Empty />],
    ['Cargo size', product.cargoSize ?? <Empty />],
    ['Shippable', product.isShippable ? 'Yes' : 'No'],
    ['Show online', product.showOnline ? 'Yes' : 'No'],
    ['Created', formatDate(product.createdAt)],
    ['Updated', formatDate(product.updatedAt)],
  ]

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Product details</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-fg-muted shrink-0">{label}</span>
            <span className="text-fg text-right font-medium">{value}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

function StockTable({ product }: { product: Product }) {
  const locations = new Map<string, { name: string; byVariation: Record<string, number> }>()
  for (const v of product.variations) {
    for (const at of v.stockByLocation) {
      const entry = locations.get(at.locationId) ?? { name: at.locationName, byVariation: {} }
      entry.byVariation[v.id] = at.quantity
      locations.set(at.locationId, entry)
    }
  }

  if (locations.size === 0) {
    return (
      <Card>
        <EmptyState
          title="No stock anywhere"
          description="Stock arrives through Goods receipt, not through the product form."
        />
      </Card>
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr className="text-fg-muted text-2xs tracking-wide uppercase">
              <th scope="col" className="h-9 px-3 text-left font-semibold">
                Location
              </th>
              {product.variations.map((v) => (
                <th key={v.id} scope="col" className="h-9 px-3 text-right font-semibold">
                  {v.name}
                </th>
              ))}
              <th scope="col" className="h-9 px-3 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {[...locations.entries()].map(([id, entry]) => {
              const total = Object.values(entry.byVariation).reduce((a, b) => a + b, 0)
              return (
                <tr key={id}>
                  <td className="text-fg px-3 py-2">{entry.name}</td>
                  {product.variations.map((v: ProductVariation) => (
                    <td key={v.id} className="px-3 py-2 text-right tabular-nums">
                      {entry.byVariation[v.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <Card className="p-4">
      <p className="text-fg-muted text-sm">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tracking-tight',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </p>
    </Card>
  )
}
