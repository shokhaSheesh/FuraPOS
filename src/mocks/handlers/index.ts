import { catalogHandlers } from './catalog'
import { dashboardHandlers } from './dashboard'
import { salesHandlers } from './sales'
import { sessionHandlers } from './session'

export const handlers = [
  ...sessionHandlers,
  ...catalogHandlers,
  ...salesHandlers,
  ...dashboardHandlers,
]
