import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Node-side counterpart of the browser worker — used by tests. */
export const server = setupServer(...handlers)
