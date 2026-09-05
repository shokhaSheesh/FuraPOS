import { http, HttpResponse } from 'msw'
import { api } from './api'
import type { CurrentUser } from '@/app/providers/SessionProvider'

const currentUser: CurrentUser = {
  id: 'usr-1',
  name: 'Akhmet Dauletmuratov',
  email: 'akhmet@fura.uz',
  avatarUrl: null,
  role: { id: 'role-1', name: 'Owner' },
  company: { id: 'cmp-1', name: 'Fura Retail', plan: 'pro' },
  locationIds: ['loc-1', 'loc-2', 'loc-3'],
  // '*' = everything. Swap for a narrow list to exercise the permission guards.
  permissions: ['*'],
}

export const sessionHandlers = [http.get(api('/me'), () => HttpResponse.json(currentUser))]
