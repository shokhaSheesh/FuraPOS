import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import type { EmployeeRow } from '../api/employees'
import { employeeStatusLabel, type EmployeeStatus } from './employee'

/** The employees list's search panel: its columns, worked-out figures given a getter. */
export const EMPLOYEE_FILTER_OVERRIDES: FieldOverrides<EmployeeRow> = {
  fullName: { type: 'text' },
  roleName: { type: 'options' },
  phone: { type: 'text' },
  email: { type: 'text' },
  sold: { label: 'Sold this month (UZS)', get: (e) => Math.round(e.stats.revenueThisMonth) },
  averageCheck: {
    get: (e) => (e.stats.sales === 0 ? null : Math.round(e.stats.averageCheck)),
  },
  lastActive: { type: 'date', get: (e) => e.lastActiveAt },
  status: {
    type: 'options',
    optionLabel: (value) => employeeStatusLabel(value as EmployeeStatus),
  },
  hiredAt: { type: 'date' },
  salary: { get: (e) => e.salary },
}
