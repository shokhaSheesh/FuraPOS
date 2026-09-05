import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="flex h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
