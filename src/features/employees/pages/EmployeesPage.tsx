import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { EMPLOYEE_FILTER_OVERRIDES } from '../model/employeeFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { useEmployeeStatusCounts, useEmployees, type EmployeeRow } from '../api/employees'
import { Avatar } from '../components/Avatar'
import { daysSinceActive, employeeStatusLabel, employeeStatusTone } from '../model/employee'

/**
 * Who works here.
 *
 * Ordered by what they sell, not alphabetically. An alphabetical staff list is
 * a phone book; a manager opening this wants to know who is carrying the shop
 * and whose login has gone quiet, and both are answers this table gives before
 * anyone clicks anything.
 */
export default function EmployeesPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data: everyEmployee } = useEmployees()
  const roles = useDataStore((s) => s.roles)
  const locations = useDataStore((s) => s.locations)

  const filters = {
    f: query.f,
    search: query.search,
    role: query.role,
    location: query.location,
    status: query.status,
  }
  const { data, isLoading } = useEmployees(filters)
  const { data: counts } = useEmployeeStatusCounts(filters)
  const canSeePay = can('personnel.employees.edit')

  const columns = useMemo<TableColumn<EmployeeRow>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Name',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={row.original.fullName} src={row.original.avatarUrl} />
            <div className="min-w-0">
              <p className="text-fg truncate font-medium">{row.original.fullName}</p>
              <p className="text-fg-subtle text-2xs truncate">
                {row.original.locationName ?? 'All locations'}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'roleName',
        header: 'Role',
        enableHiding: false,
        cell: ({ row }) => <Badge tone="info">{row.original.roleName}</Badge>,
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.phone ?? <span className="text-fg-subtle">—</span>}
          </span>
        ),
      },
      { accessorKey: 'email', header: 'Email' },
      {
        id: 'sold',
        header: 'Sold this month',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const { stats } = row.original
          if (stats.salesThisMonth === 0) {
            return <span className="text-fg-subtle">Nothing yet</span>
          }
          return (
            <div>
              <p className="text-fg font-medium tabular-nums">
                {formatMoney(Math.round(stats.revenueThisMonth))}
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {formatNumber(stats.salesThisMonth)} sales
              </p>
            </div>
          )
        },
      },
      {
        id: 'averageCheck',
        header: 'Average check',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.stats.sales === 0 ? (
            <span className="text-fg-subtle">—</span>
          ) : (
            <span className="tabular-nums">
              {formatMoney(Math.round(row.original.stats.averageCheck))}
            </span>
          ),
      },
      {
        id: 'lastActive',
        header: 'Last active',
        enableHiding: false,
        cell: ({ row }) => {
          const days = daysSinceActive(row.original)
          if (days === null) return <span className="text-fg-subtle">Never signed in</span>
          const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
          return (
            <span className={row.original.dormant ? 'text-warning' : 'text-fg-muted'}>{label}</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone={employeeStatusTone(row.original.status)}>
            {employeeStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: 'hiredAt',
        header: 'Hired',
        cell: ({ row }) => formatDate(row.original.hiredAt),
      },
      ...(canSeePay
        ? [
            {
              id: 'salary',
              header: 'Base pay',
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: EmployeeRow } }) =>
                row.original.salary === null ? (
                  <span className="text-fg-subtle">—</span>
                ) : (
                  <span className="tabular-nums">
                    {formatMoney(row.original.salary)}
                    <span className="text-fg-subtle text-2xs"> /mo</span>
                  </span>
                ),
            },
          ]
        : []),
    ],
    [canSeePay],
  )

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone who works here and what they can sign in to. An account is also a sales record, so this is where you see who is carrying the shop and whose login nobody has closed."
        action={
          can('personnel.employees.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.personnel.newEmployee}>
                <Plus />
                Add employee
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Filter by status"
              options={[
                { value: null, label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'archived', label: 'Archived' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(status) => setQuery({ status, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label="Filter by role"
              label="Role"
              allLabel="Any role"
              value={(query.role as string | null) ?? null}
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              onChange={(role) => setQuery({ role, page: null })}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="At"
              allLabel="Everywhere"
              value={(query.location as string | null) ?? null}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(location) => setQuery({ location, page: null })}
            />
          </div>
        }
      />

      <DataTable
        storageKey="employees"
        columns={columns}
        initialHidden={['email', 'hiredAt', 'averageCheck']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={everyEmployee.items}
            overrides={EMPLOYEE_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(employee) => navigate(paths.personnel.employeeDetail(employee.id))}
        emptyState={
          query.search || query.f || query.status || query.role || query.location ? (
            <EmptyState title="Nobody matches these filters" />
          ) : (
            <EmptyState
              title="No employees yet"
              description="Add the people who work here to give them a sign-in and start attributing sales."
              action={
                can('personnel.employees.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.personnel.newEmployee}>
                      <Plus />
                      Add employee
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />
    </>
  )
}
