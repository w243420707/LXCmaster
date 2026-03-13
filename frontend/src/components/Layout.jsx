import { NavLink, Outlet } from 'react-router-dom'

function Layout() {
  const navItems = [
    { to: '/', label: '仪表盘', icon: '📊' },
    { to: '/containers', label: '容器管理', icon: '📦' },
    { to: '/images', label: '镜像管理', icon: '💿' },
    { to: '/settings', label: '系统设置', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-800 border-r border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-blue-400">LXCmaster</h1>
          <p className="text-xs text-gray-500">Incus 容器管理面板</p>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
