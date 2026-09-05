import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/**
 * Started from main.tsx while VITE_USE_MOCKS is on. Unhandled requests warn
 * rather than error, so a half-migrated endpoint is visible but not fatal.
 */
export async function startMockServer() {
  await worker.start({ onUnhandledRequest: 'warn', quiet: true })
}
