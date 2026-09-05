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
          <div className="mx-auto max-w-[1600px] space-y-4 p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastViewport />
    </div>
  )
}
