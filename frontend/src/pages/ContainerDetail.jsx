import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import Console from '../components/Console'

function ContainerDetail() {
  const { name } = useParams()
  const [container, setContainer] = useState(null)
  const [ports, setPorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [showPortModal, setShowPortModal] = useState(false)
  const [portForm, setPortForm] = useState({
    host_port: '',
    container_port: '',
    protocol: 'tcp',
  })

  useEffect(() => {
    loadData()
  }, [name])

  const loadData = async () => {
    setLoading(true)
    try {
      const [containerData, portsData] = await Promise.all([
        api.containers.get(name),
        api.containers.ports.list(name),
      ])
      setContainer(containerData.container)
      setPorts(portsData.mappings || [])
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action) => {
    try {
      await api.containers[action](name)
      loadData()
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  const handleAddPort = async (e) => {
    e.preventDefault()
    try {
      await api.containers.ports.add(name, {
        ...portForm,
        host_port: parseInt(portForm.host_port),
        container_port: parseInt(portForm.container_port),
      })
      setShowPortModal(false)
      setPortForm({ host_port: '', container_port: '', protocol: 'tcp' })
      loadData()
    } catch (err) {
      alert('添加失败: ' + err.message)
    }
  }

  const handleDeletePort = async (port) => {
    if (!confirm('确定删除此端口映射？')) return
    try {
      await api.containers.ports.delete(name, port)
      loadData()
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  if (!container) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">容器不存在</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">{container.name}</h2>
          <p className="text-gray-400">
            <span
              className={`inline-flex items-center gap-1 ${
                container.status === 'Running' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  container.status === 'Running' ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              {container.status}
            </span>
            {container.ip_address && ` · ${container.ip_address}`}
          </p>
        </div>
        <div className="flex gap-2">
          {container.status === 'Running' ? (
            <>
              <button
                onClick={() => handleAction('stop')}
                className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded"
              >
                停止
              </button>
              <button
                onClick={() => handleAction('restart')}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              >
                重启
              </button>
            </>
          ) : (
            <button
              onClick={() => handleAction('start')}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            >
              启动
            </button>
          )}
          <button
            onClick={() => handleAction('delete')}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            删除
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['info', 'ports', 'console'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab === 'info' && '信息'}
            {tab === 'ports' && '端口映射'}
            {tab === 'console' && '控制台'}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 text-sm">CPU 核心</div>
              <div className="text-lg">{container.cpu || '-'} 核</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">内存限制</div>
              <div className="text-lg">{container.memory || '-'} MB</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">磁盘限制</div>
              <div className="text-lg">{container.disk || '-'} MB</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">IP 地址</div>
              <div className="text-lg">{container.ip_address || '-'}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ports' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowPortModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              添加端口映射
            </button>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <table className="w-full">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="text-left p-4 text-gray-400 font-medium">宿主机端口</th>
                  <th className="text-left p-4 text-gray-400 font-medium">容器端口</th>
                  <th className="text-left p-4 text-gray-400 font-medium">协议</th>
                  <th className="text-left p-4 text-gray-400 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {ports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      暂无端口映射
                    </td>
                  </tr>
                ) : (
                  ports.map((port, idx) => (
                    <tr key={idx} className="hover:bg-gray-750">
                      <td className="p-4">{port.host_port}</td>
                      <td className="p-4">{port.container_port}</td>
                      <td className="p-4">{port.protocol}</td>
                      <td className="p-4">
                        <button
                          onClick={() => handleDeletePort(port.host_port)}
                          className="text-red-400 hover:text-red-300"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {showPortModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
                <h3 className="text-xl font-bold mb-4">添加端口映射</h3>
                <form onSubmit={handleAddPort} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">宿主机端口</label>
                    <input
                      type="number"
                      value={portForm.host_port}
                      onChange={(e) =>
                        setPortForm({ ...portForm, host_port: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">容器端口</label>
                    <input
                      type="number"
                      value={portForm.container_port}
                      onChange={(e) =>
                        setPortForm({ ...portForm, container_port: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">协议</label>
                    <select
                      value={portForm.protocol}
                      onChange={(e) =>
                        setPortForm({ ...portForm, protocol: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowPortModal(false)}
                      className="px-4 py-2 rounded border border-gray-600 hover:bg-gray-700"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
                    >
                      添加
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'console' && (
        <Console containerName={name} />
      )}
    </div>
  )
}

export default ContainerDetail
