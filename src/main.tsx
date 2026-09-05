import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers/AppProviders'
import { router } from '@/app/router'
import '@/styles/global.css'

/**
 * Mocks are the only data source until the backend exists. Flip
 * VITE_USE_MOCKS=false (and set VITE_API_BASE_URL) to talk to a real API.
 *
 * Start-up is bounded: a service worker that never registers (private windows,
 * some headless environments) must not leave the user staring at a blank page.
 */
async function startMocks() {
  if (import.meta.env.VITE_USE_MOCKS === 'false') return
  try {
    const { startMockServer } = await import('@/mocks/browser')
    await Promise.race([
      startMockServer(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ])
  } catch (error) {
    console.warn('[mocks] service worker unavailable — requests will hit the network', error)
  }
}

async function bootstrap() {
  await startMocks()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}

void bootstrap()
