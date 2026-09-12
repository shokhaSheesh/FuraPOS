import { Link, useParams } from 'react-router'
import { ArrowLeft, Truck as TruckIcon, UserRound } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { paths } from '@/shared/config/paths'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDriver, useDriverSales } from '../api/drivers'
import { KIND_LABEL, describeTruck, kindOf, type Truck } from '../model/driver'

/**
 * One driver.
 *
 * The list answers "who drives for whom"; this answers "what has he bought,
 * and in which truck". His own lorries and his autopark's are shown as two
 * separate things rather than one merged list, for the same reason the tabs
 * keep them apart: they are two different customers wearing one man's name.
 */
export default function DriverDetailPage() {
  const { driverId } = useParams()
  const { data: driver } = useDriver(driverId)
  const sales = useDriverSales(driverId)

  if (!driver) {
    return (
      <EmptyState icon={UserRound} title="No such driver" description="He may have been removed." />
    )
  }

  const spent = sales.reduce((sum, sale) => sum + sale.total, 0)
  const lastSale = sales[0]
  const kind = kindOf(driver)

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.marketing.drivers}>
          <ArrowLeft />
          Drivers
        </Link>
      </Button>

      <PageHeader
        title={driver.fullName}
        description={[driver.code, driver.phone].filter(Boolean).join(' · ')}
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={kind === 'both' ? 'info' : 'neutral'}>{KIND_LABEL[kind]}</Badge>
            <Badge tone={driver.status === 'active' ? 'success' : 'neutral'}>
              {driver.status === 'active' ? 'Driving' : 'No longer driving'}
            </Badge>
            {driver.autoparkId ? (
              <Link
                to={paths.marketing.autoparkDetail(driver.autoparkId)}
                className="text-fg-muted text-2xs hover:underline"
              >
                {driver.autoparkName}
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Purchases" value={formatNumber(sales.length)} />
        <Stat label="Spent" value={formatMoney(spent)} />
        <Stat
          label="Last bought"
          value={lastSale ? formatDate(lastSale.createdAt) : '—'}
          hint={lastSale?.truckPlate ?? undefined}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TruckList
          title="His own trucks"
          empty="He owns none — he drives only for his autopark."
          trucks={driver.ownTrucks}
        />
        <TruckList
          title={driver.autoparkName ? `${driver.autoparkName}'s truck` : "Autopark's truck"}
          empty="He drives for no autopark."
          trucks={driver.autoparkTruck ? [driver.autoparkTruck] : []}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          <Row label="Code" value={<span className="font-mono">{driver.code}</span>} />
          <Row label="Phone" value={driver.phone ?? '—'} />
          {/* Off the table and onto here: nobody scans a list for a licence
              number, but it has to live somewhere. */}
          <Row
            label="Licence"
            value={
              driver.licenceNumber ? <span className="font-mono">{driver.licenceNumber}</span> : '—'
            }
          />
          <Row
            label="Autopark"
            value={
              driver.autoparkId ? (
                <Link
                  to={paths.marketing.autoparkDetail(driver.autoparkId)}
                  className="hover:underline"
                >
                  {driver.autoparkName}
                </Link>
              ) : (
                'Owner-driver'
              )
            }
          />
          <Row label="Added" value={formatDate(driver.createdAt)} />
          {driver.comment ? <Row label="Note" value={driver.comment} /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchases</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {sales.length === 0 ? (
            <p className="text-fg-subtle px-4 py-6 text-center text-sm">
              He has collected nothing yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Sale</th>
                    <th className="px-4 py-2 text-left font-semibold">When</th>
                    <th className="px-4 py-2 text-left font-semibold">Truck</th>
                    <th className="px-4 py-2 text-left font-semibold">Bought for</th>
                    <th className="px-4 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 25).map((sale) => (
                    <tr key={sale.id} className="border-border border-t">
                      <td className="px-4 py-2">
                        <Link
                          to={paths.sales.orderDetail(sale.id)}
                          className="text-fg font-medium hover:underline"
                        >
                          {sale.number}
                        </Link>
                      </td>
                      <td className="text-fg-muted px-4 py-2">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{sale.truckPlate ?? '—'}</td>
                      {/* The client on the sale is the autopark when he bought
                          on their contract, and nobody when he bought for
                          himself — so this column says which it was. */}
                      <td className="text-fg-muted px-4 py-2">{sale.clientName ?? 'Himself'}</td>
                      <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                        {formatMoney(sale.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-fg-muted text-2xs">{label}</p>
        <p className="text-fg text-lg font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-fg-subtle text-2xs font-mono">{hint}</p> : null}
      </CardBody>
    </Card>
  )
}

function TruckList({ title, trucks, empty }: { title: string; trucks: Truck[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className={trucks.length ? 'space-y-2' : undefined}>
        {trucks.length === 0 ? (
          <p className="text-fg-subtle text-sm">{empty}</p>
        ) : (
          trucks.map((truck) => (
            <div key={truck.plate} className="flex items-center gap-2.5">
              <TruckIcon className="text-fg-subtle size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-fg font-mono text-sm">{truck.plate}</p>
                <p className="text-fg-subtle text-2xs">
                  {describeTruck(truck) || 'Make not recorded'}
                </p>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="text-fg min-w-0 truncate text-right">{value}</span>
    </div>
  )
}
