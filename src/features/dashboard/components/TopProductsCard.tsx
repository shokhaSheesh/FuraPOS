import { Link } from 'react-router'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Skeleton } from '@/shared/ui/Skeleton'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { DashboardSummary } from '../api/summary'

/** OX has this on the seller dashboard; it belongs on the main one. */
export function TopProductsCard({
  products,
  loading,
}: {
  products: DashboardSummary['topProducts']
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top products</CardTitle>
        <Button variant="link" size="sm" className="h-auto px-0" asChild>
          <Link to={paths.analytics.sales}>Full report</Link>
        </Button>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                <th scope="col" className="pb-2 text-left font-semibold">
                  Product
                </th>
                <th scope="col" className="pb-2 text-right font-semibold">
                  Qty
                </th>
                <th scope="col" className="pb-2 text-right font-semibold">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="text-fg max-w-0 truncate py-2 pr-3">{product.name}</td>
                  <td className="text-fg-muted py-2 text-right tabular-nums">
                    {formatNumber(product.quantity)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatMoney(product.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  )
}
