import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ToastViewport } from '@/shared/ui/toast'

export function AppShell() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          {/* Full width at every size — a big desktop gets more room, not wider margins. */}
          <div className="space-y-4 p-4 lg:p-6 2xl:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastViewport />
    </div>
  )
}
