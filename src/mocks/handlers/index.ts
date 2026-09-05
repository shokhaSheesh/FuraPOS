import { catalogHandlers } from './catalog'
import { dashboardHandlers } from './dashboard'
import { sessionHandlers } from './session'

export const handlers = [...sessionHandlers, ...catalogHandlers, ...dashboardHandlers]
