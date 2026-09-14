import { Pencil, PlayCircle, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import { Switch } from '@/shared/ui/Switch'
import { useDataStore } from '@/data/store'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import {
  costInUzs,
  discountAmount,
  effectivePrice,
  marginRatio,
  PART_SIDES,
  PRODUCT_FLAGS,
  type ProductFlag,
  type VariationRow,
} from '../model/product'

const Empty = () => <span className="text-fg-subtle">—</span>

/** Cost may be quoted in USD, so it is always shown with its currency. */
const cost = (v: VariationRow) =>
  v.costCurrency === 'USD' ? `${formatNumber(v.costPrice)} USD` : formatMoney(v.costPrice)

const text = (value: string | null) => value ?? <Empty />

/**
 * Every column OX's Вариации list offers, in OX's own order, and nothing taken
 * away — the brief is parity first, pruning after. The Russian name of each is
 * beside it so the two lists can be read against each other; the mapping is
 * also in docs/OX-NAVIGATION-MAP.md. Margin and Status are ours and sit after
 * OX's last column.
 *
 * Cost columns still need `products.cost.view`: parity with OX's column list
 * does not mean showing a seller what we paid.
 */
export function buildProductColumns({
  usdRate,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  canSeeCost,
}: {
  usdRate: number
  onEdit: (row: VariationRow) => void
  onDelete: (row: VariationRow) => void
  canEdit: boolean
  canDelete: boolean
  canSeeCost: boolean
}): TableColumn<VariationRow>[] {
  const costOnly = (columns: TableColumn<VariationRow>[]) => (canSeeCost ? columns : [])

  return [
    // Рисунок
    {
      id: 'image',
      header: 'Image',
      cell: ({ row }) => <ProductThumb src={row.original.imageUrl} size="sm" />,
    },
    // ID Вариации
    {
      accessorKey: 'id',
      header: 'Variation ID',
      cell: ({ row }) => (
        <span className="text-fg-muted text-2xs font-mono">{row.original.id}</span>
      ),
    },
    // Названия вариации
    {
      accessorKey: 'fullName',
      header: 'Variation name',
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="font-medium">{row.original.productName}</span>
          {row.original.name !== 'Standard' ? (
            <span className="text-fg-muted"> · {row.original.name}</span>
          ) : null}
        </div>
      ),
      enableHiding: false,
    },
    // Штрих-код
    {
      accessorKey: 'barcode',
      header: 'Barcode',
      cell: ({ row }) =>
        row.original.barcode ? (
          <span className="text-2xs font-mono">{row.original.barcode}</span>
        ) : (
          <Empty />
        ),
    },
    // Артикул
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.sku}</span>,
    },
    // Категории
    {
      accessorKey: 'categoryPath',
      header: 'Categories',
      cell: ({ row }) => row.original.categoryPath,
    },
    // Бренд
    {
      accessorKey: 'brandName',
      header: 'Brand',
      cell: ({ row }) => text(row.original.brandName),
    },
    // Описание
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => text(row.original.description),
    },
    // Теги
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) => <Chips values={row.original.tags} />,
    },
    // С этим вместе покупают
    {
      id: 'boughtTogetherIds',
      header: 'Frequently bought together',
      cell: ({ row }) => <LinkedProducts ids={row.original.boughtTogetherIds} />,
    },
    // Аналоги
    {
      id: 'analogueIds',
      header: 'Analogues',
      cell: ({ row }) => <LinkedProducts ids={row.original.analogueIds} />,
    },
    // Отгружаемый … Весовой — switched in place, as OX does
    ...PRODUCT_FLAGS.map((flag): TableColumn<VariationRow> => ({
      accessorKey: flag.key,
      header: flag.label,
      cell: ({ row }) => <FlagToggle row={row.original} flag={flag.key} label={flag.label} />,
    })),
    // Видео
    {
      accessorKey: 'videoUrl',
      header: 'Video',
      cell: ({ row }) =>
        row.original.videoUrl ? (
          <a
            href={row.original.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            <PlayCircle className="size-4" />
            Watch
          </a>
        ) : (
          <Empty />
        ),
    },
    // Зона
    {
      accessorKey: 'zone',
      header: 'Zone',
      cell: ({ row }) => text(row.original.zone),
    },
    // Локация
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const at = row.original.stockByLocation
        if (!at.length) return <Empty />
        // One location reads as itself; several read as a count, with the
        // breakdown on hover rather than a cell nobody can fit.
        return at.length === 1 ? (
          at[0]!.locationName
        ) : (
          <span title={at.map((s) => `${s.locationName}: ${s.quantity}`).join('\n')}>
            {at.length} locations
          </span>
        )
      },
    },
    // Кол-во
    {
      accessorKey: 'stock',
      header: 'Quantity',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const { stock, lowStockThreshold, unit } = row.original
        // Low stock is "needs attention" (warning), out of stock is a problem
        // (danger). Neither is blue — blue is the brand.
        const low = lowStockThreshold !== null && stock <= lowStockThreshold
        const out = stock === 0
        return (
          <span
            className={
              out ? 'text-danger font-medium' : low ? 'text-warning font-medium' : undefined
            }
          >
            {formatNumber(stock)} {unit}
          </span>
        )
      },
    },
    // Цена продажи за ед.
    {
      accessorKey: 'salePrice',
      header: 'Sale price per unit',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.salePrice),
    },
    // Общая сумма продажи
    {
      id: 'saleValue',
      header: 'Total sale value',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(effectivePrice(row.original) * row.original.stock),
    },
    // Со скидкой
    {
      accessorKey: 'discountPrice',
      header: 'Discounted',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.discountPrice ? (
          <span className="text-warning">{formatMoney(row.original.discountPrice)}</span>
        ) : (
          <Empty />
        ),
    },
    // Скидка
    {
      id: 'discount',
      header: 'Discount',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const off = discountAmount(row.original)
        return off > 0 ? <span className="text-warning">− {formatMoney(off)}</span> : <Empty />
      },
    },
    ...costOnly([
      // Цена поставщика за ед.
      {
        accessorKey: 'costPrice',
        header: 'Supplier price per unit',
        meta: { align: 'right' },
        cell: ({ row }) => cost(row.original),
      },
      // Общая сумма поставщ.
      {
        id: 'costValue',
        header: 'Total supplier value',
        meta: { align: 'right' },
        cell: ({ row }) => formatMoney(costInUzs(row.original, usdRate) * row.original.stock),
      },
      // Себестоимость
      {
        accessorKey: 'landedCost',
        header: 'Landed cost',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.landedCost === null ? <Empty /> : formatMoney(row.original.landedCost),
      },
    ]),
    // Марка
    {
      accessorKey: 'vehicleMake',
      header: 'Make',
      cell: ({ row }) => text(row.original.vehicleMake),
    },
    // Вес карго
    {
      accessorKey: 'cargoWeightKg',
      header: 'Cargo weight',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.cargoWeightKg ? `${formatNumber(row.original.cargoWeightKg)} kg` : <Empty />,
    },
    // Размер карго
    {
      accessorKey: 'cargoSize',
      header: 'Cargo size',
      cell: ({ row }) => text(row.original.cargoSize),
    },
    // Категория конечное
    {
      accessorKey: 'categoryName',
      header: 'End category',
      cell: ({ row }) => row.original.categoryName,
    },
    // Бренд товара
    {
      accessorKey: 'manufacturer',
      header: 'Product brand',
      cell: ({ row }) => text(row.original.manufacturer),
    },
    // Артикул моб
    {
      accessorKey: 'mobileSku',
      header: 'Mobile SKU',
      cell: ({ row }) =>
        row.original.mobileSku ? (
          <span className="text-2xs font-mono">{row.original.mobileSku}</span>
        ) : (
          <Empty />
        ),
    },
    // Название продукта моб
    {
      accessorKey: 'mobileName',
      header: 'Mobile product name',
      cell: ({ row }) => text(row.original.mobileName),
    },
    // Часть
    {
      accessorKey: 'partSide',
      header: 'Part',
      cell: ({ row }) =>
        PART_SIDES.find((s) => s.value === row.original.partSide)?.label ?? <Empty />,
    },
    // OEM
    {
      accessorKey: 'oem',
      header: 'OEM',
      cell: ({ row }) =>
        row.original.oem ? (
          <span className="text-2xs font-mono">{row.original.oem}</span>
        ) : (
          <Empty />
        ),
    },
    // Тип
    {
      accessorKey: 'partType',
      header: 'Type',
      cell: ({ row }) => text(row.original.partType),
    },
    // Пол
    {
      accessorKey: 'gender',
      header: 'Gender',
      cell: ({ row }) => text(row.original.gender),
    },
    // Сезон
    {
      accessorKey: 'season',
      header: 'Season',
      cell: ({ row }) => text(row.original.season),
    },
    // Модель
    {
      id: 'vehicleModels',
      header: 'Model',
      cell: ({ row }) =>
        row.original.vehicleModels.length ? row.original.vehicleModels.join(', ') : <Empty />,
    },
    // Адрес товара
    {
      accessorKey: 'shelfAddress',
      header: 'Product address',
      cell: ({ row }) => text(row.original.shelfAddress),
    },
    // Вместе покупает
    {
      accessorKey: 'boughtTogetherNote',
      header: 'Buys together',
      cell: ({ row }) => text(row.original.boughtTogetherNote),
    },
    // Ours, not OX's
    ...costOnly([
      {
        id: 'margin',
        header: 'Margin',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="text-fg-muted">{formatPercent(marginRatio(row.original, usdRate))}</span>
        ),
      },
    ]),
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.status === 'active' ? (
          <Badge tone="success">Active</Badge>
        ) : row.original.status === 'draft' ? (
          <Badge tone="warning">Draft</Badge>
        ) : (
          <Badge>Archived</Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: 'Edit', icon: Pencil, onSelect: () => onEdit(row.original), hidden: !canEdit },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              onSelect: () => onDelete(row.original),
              hidden: !canDelete,
            },
          ]}
        />
      ),
    },
  ]
}

/** Hidden on first open; the list starts with what it always showed, now in OX's order. */
export const PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT = [
  'id',
  'description',
  'tags',
  'boughtTogetherIds',
  'analogueIds',
  ...PRODUCT_FLAGS.map((flag) => flag.key),
  'videoUrl',
  'zone',
  'location',
  'saleValue',
  'discountPrice',
  'discount',
  'costValue',
  'landedCost',
  'cargoWeightKg',
  'cargoSize',
  'categoryName',
  'manufacturer',
  'mobileSku',
  'mobileName',
  'partSide',
  'oem',
  'partType',
  'gender',
  'season',
  'vehicleModels',
  'shelfAddress',
  'boughtTogetherNote',
]

function Chips({ values }: { values: string[] }) {
  if (!values.length) return <Empty />
  return (
    <div className="flex gap-1">
      {values.map((value) => (
        <Badge key={value}>{value}</Badge>
      ))}
    </div>
  )
}

/** Linked parts by name; the first is shown, the rest counted, all of them on hover. */
function LinkedProducts({ ids }: { ids: string[] }) {
  const products = useDataStore((s) => s.products)
  if (!ids.length) return <Empty />
  const names = ids.map((id) => products.find((p) => p.id === id)?.name ?? id)
  return (
    <span title={names.join('\n')}>
      {names[0]}
      {names.length > 1 ? <span className="text-fg-muted"> +{names.length - 1}</span> : null}
    </span>
  )
}

/**
 * The yes/no columns are edited in place, as in the reference product. They
 * live on the *product*, so flipping one moves every variation of that part —
 * which is why the store updates them together rather than per row.
 */
function FlagToggle({ row, flag, label }: { row: VariationRow; flag: ProductFlag; label: string }) {
  const setFlag = useDataStore((s) => s.setProductFlag)
  return (
    <Switch
      checked={row[flag]}
      onCheckedChange={(value) => setFlag(row.productId, flag, value)}
      aria-label={`${label} — ${row.fullName}`}
    />
  )
}
