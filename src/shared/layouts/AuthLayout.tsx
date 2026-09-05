import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="bg-canvas flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
