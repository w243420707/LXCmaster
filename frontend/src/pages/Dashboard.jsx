import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

function Dashboard() {
  const [stats, setStats] = useState({
    containers: [],
    images: [],
    networks: [],
    storage: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.containers.list(),
      api.images.list(),
      api.networks.list(),
      api.storage.list(),
    ])
      .then(([containers, images, networks, storage]) => {
        setStats({ containers, images, networks, storage })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  const runningCount = stats.containers.filter((c) => c.status === 'Running').length
  const stoppedCount = stats.containers.filter((c) => c.status !== 'Running').length

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">仪表盘</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">运行中容器</div>
          <div className="text-3xl font-bold text-green-400">{runningCount}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">已停止容器</div>
          <div className="text-3xl font-bold text-red-400">{stoppedCount}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">可用镜像</div>
          <div className="text-3xl font-bold text-blue-400">{stats.images.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">存储池</div>
          <div className="text-3xl font-bold text-purple-400">{stats.storage.length}</div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold">容器列表</h3>
          <Link
            to="/containers"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            查看全部 →
          </Link>
        </div>
        <div className="divide-y divide-gray-700">
          {stats.containers.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">暂无容器</div>
          ) : (
            stats.containers.slice(0, 5).map((container) => (
              <div
                key={container.name}
                className="p-4 flex items-center justify-between hover:bg-gray-750"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      container.status === 'Running'
                        ? 'bg-green-400'
                        : 'bg-red-400'
                    }`}
                  />
                  <Link
                    to={`/containers/${container.name}`}
                    className="font-medium hover:text-blue-400"
                  >
                    {container.name}
                  </Link>
                </div>
                <span
                  className={`text-sm ${
                    container.status === 'Running'
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {container.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
