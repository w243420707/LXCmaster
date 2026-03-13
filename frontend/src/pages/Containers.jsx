import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const PRESET_IMAGES = [
  { value: 'alpine/3.18', label: 'Alpine 3.18 (轻量推荐)', os: 'Alpine' },
  { value: 'debian/11', label: 'Debian 11 (稳定)', os: 'Debian' },
]

function Containers() {
  const [containers, setContainers] = useState([])
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createProgress, setCreateProgress] = useState('')
  const [createForm, setCreateForm] = useState({
    name: '',
    image: 'alpine/3.18',
    cpu: 1,
    memory: 512,
    diskMax: 10,
    enableSwap: true,
    enableSSH: true,
    sshPort: 22,
    rootPassword: '',
    portMappings: [],
  })
  const [newPort, setNewPort] = useState({
    hostPort: '',
    containerPort: '',
    protocols: ['tcp', 'udp'],
    ipVersions: ['v4', 'v6'],
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [containersData, imagesData] = await Promise.all([
        api.containers.list(),
        api.images.list(),
      ])
      setContainers(containersData)
      setImages(imagesData)
    } finally {
      setLoading(false)
    }
  }

  const waitForContainer = async (name, timeout = 120000) => {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      try {
        const container = await api.containers.get(name)
        if (container.container?.status === 'Running') {
          return true
        }
      } catch (e) {
        // Container might not exist yet
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    return false
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateProgress('正在创建容器...')
    
    try {
      await api.containers.create(createForm)
      setCreateProgress('容器创建中，请稍候...')
      
      // Wait for container to be created
      let attempts = 0
      const maxAttempts = 30
      while (attempts < maxAttempts) {
        try {
          const containers = await api.containers.list()
          const newContainer = containers.find(c => c.name === createForm.name)
          if (newContainer) {
            if (createForm.enableSSH) {
              setCreateProgress('容器已创建，正在配置 SSH...')
              // Wait for SSH setup (container needs to start)
              await new Promise(r => setTimeout(r, 10000))
            }
            break
          }
        } catch (e) {
          // Ignore errors while polling
        }
        await new Promise(r => setTimeout(r, 2000))
        attempts++
        setCreateProgress(`正在等待容器就绪... (${attempts}/${maxAttempts})`)
      }
      
      setCreateProgress('创建完成！')
      setShowCreate(false)
      setCreateForm({
        name: '',
        image: 'alpine/3.18',
        cpu: 1,
        memory: 512,
        diskMax: 10,
        enableSwap: true,
        enableSSH: true,
        sshPort: 22,
        rootPassword: '',
        portMappings: [],
      })
      loadData()
    } catch (err) {
      setCreateProgress('创建失败: ' + err.message)
    } finally {
      setCreating(false)
      setTimeout(() => setCreateProgress(''), 3000)
    }
  }

  const handleAction = async (name, action) => {
    try {
      await api.containers[action](name)
      loadData()
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  const toggleProtocol = (protocol) => {
    const protocols = newPort.protocols.includes(protocol)
      ? newPort.protocols.filter(p => p !== protocol)
      : [...newPort.protocols, protocol]
    setNewPort({ ...newPort, protocols })
  }

  const toggleIpVersion = (version) => {
    const ipVersions = newPort.ipVersions.includes(version)
      ? newPort.ipVersions.filter(v => v !== version)
      : [...newPort.ipVersions, version]
    setNewPort({ ...newPort, ipVersions })
  }

  const addPortMapping = () => {
    if (newPort.hostPort && newPort.containerPort && newPort.protocols.length > 0 && newPort.ipVersions.length > 0) {
      setCreateForm({
        ...createForm,
        portMappings: [...createForm.portMappings, { ...newPort }]
      })
      setNewPort({
        hostPort: '',
        containerPort: '',
        protocols: ['tcp', 'udp'],
        ipVersions: ['v4', 'v6'],
      })
    }
  }

  const removePortMapping = (index) => {
    setCreateForm({
      ...createForm,
      portMappings: createForm.portMappings.filter((_, i) => i !== index)
    })
  }

  const formatPortMapping = (port) => {
    const ipLabels = port.ipVersions.map(v => v === 'v4' ? 'IPv4' : 'IPv6').join('+')
    const protoLabels = port.protocols.join('/').toUpperCase()
    return `${ipLabels} ${protoLabels}: ${port.hostPort} → ${port.containerPort}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">容器管理</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
        >
          创建容器
        </button>
      </div>

      {createProgress && (
        <div className="fixed top-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg z-50 max-w-sm">
          <div className="flex items-center gap-3">
            {creating && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            )}
            <span className={creating ? 'text-blue-400' : 'text-green-400'}>
              {createProgress}
            </span>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700 my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">创建容器</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">容器名称</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  placeholder="例如: my-container"
                  required
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">镜像</label>
                <select
                  value={createForm.image}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, image: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  required
                  disabled={creating}
                >
                  {PRESET_IMAGES.map((img) => (
                    <option key={img.value} value={img.value}>
                      {img.label}
                    </option>
                  ))}
                  {images.length > 0 && (
                    <optgroup label="本地镜像">
                      {images.map((img) => (
                        <option key={img.fingerprint} value={img.alias || img.fingerprint}>
                          {img.alias || img.fingerprint.slice(0, 12)} ({img.os})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">CPU 核心</label>
                  <input
                    type="number"
                    value={createForm.cpu}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, cpu: parseInt(e.target.value) || 1 })
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    min="1"
                    max="64"
                    disabled={creating}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">内存 (MB)</label>
                  <input
                    type="number"
                    value={createForm.memory}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, memory: parseInt(e.target.value) || 512 })
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    min="64"
                    disabled={creating}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">最大存储 (GB)</label>
                  <input
                    type="number"
                    value={createForm.diskMax}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, diskMax: parseInt(e.target.value) || 10 })
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    min="1"
                    disabled={creating}
                  />
                  <p className="text-xs text-gray-500 mt-1">共享宿主机存储，限制最大使用量</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Swap 支持</label>
                  <div className="flex items-center h-10">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createForm.enableSwap}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, enableSwap: e.target.checked })
                        }
                        className="w-4 h-4 rounded"
                        disabled={creating}
                      />
                      <span className="text-sm text-gray-300">
                        启用 (内存不足时使用宿主机Swap)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">SSH 配置</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createForm.enableSSH}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, enableSSH: e.target.checked })
                        }
                        className="w-4 h-4 rounded"
                        disabled={creating}
                      />
                      <span className="text-sm text-gray-300">启用 SSH</span>
                    </label>
                    {createForm.enableSSH && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">宿主机端口:</label>
                        <input
                          type="number"
                          value={createForm.sshPort}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, sshPort: parseInt(e.target.value) || 22 })
                          }
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                          min="1"
                          max="65535"
                          disabled={creating}
                        />
                        <span className="text-xs text-gray-500">→ 容器 22 端口</span>
                      </div>
                    )}
                  </div>
                  {createForm.enableSSH && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Root 密码</label>
                      <input
                        type="text"
                        value={createForm.rootPassword}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, rootPassword: e.target.value })
                        }
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder="留空则自动生成随机密码"
                        disabled={creating}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  端口映射
                  <span className="text-xs text-gray-500 ml-2">(可选，支持端口范围如 80-100)</span>
                </label>
                <div className="space-y-2">
                  {createForm.portMappings.map((port, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-700 rounded px-3 py-2">
                      <span className="text-sm text-gray-300 flex-1">
                        {formatPortMapping(port)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePortMapping(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        disabled={creating}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">IP 版本</label>
                        <div className="flex gap-2">
                          <label className="flex items-center gap-1 cursor-pointer bg-gray-700 px-2 py-1 rounded text-sm">
                            <input
                              type="checkbox"
                              checked={newPort.ipVersions.includes('v4')}
                              onChange={() => toggleIpVersion('v4')}
                              className="w-3 h-3"
                              disabled={creating}
                            />
                            IPv4
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer bg-gray-700 px-2 py-1 rounded text-sm">
                            <input
                              type="checkbox"
                              checked={newPort.ipVersions.includes('v6')}
                              onChange={() => toggleIpVersion('v6')}
                              className="w-3 h-3"
                              disabled={creating}
                            />
                            IPv6
                          </label>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">协议</label>
                        <div className="flex gap-2">
                          <label className="flex items-center gap-1 cursor-pointer bg-gray-700 px-2 py-1 rounded text-sm">
                            <input
                              type="checkbox"
                              checked={newPort.protocols.includes('tcp')}
                              onChange={() => toggleProtocol('tcp')}
                              className="w-3 h-3"
                              disabled={creating}
                            />
                            TCP
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer bg-gray-700 px-2 py-1 rounded text-sm">
                            <input
                              type="checkbox"
                              checked={newPort.protocols.includes('udp')}
                              onChange={() => toggleProtocol('udp')}
                              className="w-3 h-3"
                              disabled={creating}
                            />
                            UDP
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={newPort.hostPort}
                        onChange={(e) => setNewPort({ ...newPort, hostPort: e.target.value })}
                        placeholder="宿主端口 (如 80-100)"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
                        disabled={creating}
                      />
                      <input
                        type="text"
                        value={newPort.containerPort}
                        onChange={(e) => setNewPort({ ...newPort, containerPort: e.target.value })}
                        placeholder="容器端口 (如 80-100)"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
                        disabled={creating}
                      />
                      <button
                        type="button"
                        onClick={addPortMapping}
                        disabled={!newPort.hostPort || !newPort.containerPort || newPort.protocols.length === 0 || newPort.ipVersions.length === 0 || creating}
                        className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded text-sm"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded border border-gray-600 hover:bg-gray-700"
                  disabled={creating}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2"
                  disabled={creating}
                >
                  {creating && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="text-left p-4 text-gray-400 font-medium">名称</th>
              <th className="text-left p-4 text-gray-400 font-medium">状态</th>
              <th className="text-left p-4 text-gray-400 font-medium">IP 地址</th>
              <th className="text-left p-4 text-gray-400 font-medium">SSH 端口</th>
              <th className="text-left p-4 text-gray-400 font-medium">SSH 密码</th>
              <th className="text-left p-4 text-gray-400 font-medium">CPU</th>
              <th className="text-left p-4 text-gray-400 font-medium">内存</th>
              <th className="text-left p-4 text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {containers.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  暂无容器
                </td>
              </tr>
            ) : (
              containers.map((container) => (
                <tr key={container.name} className="hover:bg-gray-750">
                  <td className="p-4">
                    <Link
                      to={`/containers/${container.name}`}
                      className="font-medium hover:text-blue-400"
                    >
                      {container.name}
                    </Link>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        container.status === 'Running'
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          container.status === 'Running'
                            ? 'bg-green-400'
                            : 'bg-red-400'
                        }`}
                      />
                      {container.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-300">{container.ip_address || '-'}</td>
                  <td className="p-4 text-gray-300">{container.ssh_port || '-'}</td>
                  <td className="p-4">
                    {container.root_password ? (
                      <code className="bg-gray-700 px-2 py-1 rounded text-sm text-green-400">
                        {container.root_password}
                      </code>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-300">{container.cpu || '-'} 核</td>
                  <td className="p-4 text-gray-300">{container.memory || '-'} MB</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {container.status === 'Running' ? (
                        <>
                          <button
                            onClick={() => handleAction(container.name, 'stop')}
                            className="text-yellow-400 hover:text-yellow-300"
                          >
                            停止
                          </button>
                          <button
                            onClick={() => handleAction(container.name, 'restart')}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            重启
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAction(container.name, 'start')}
                          className="text-green-400 hover:text-green-300"
                        >
                          启动
                        </button>
                      )}
                      <Link
                        to={`/containers/${container.name}`}
                        className="text-gray-400 hover:text-gray-300"
                      >
                        详情
                      </Link>
                      <Link
                        to={`/terminal/${container.name}`}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        终端
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`确定要删除容器 ${container.name} 吗？`)) {
                            handleAction(container.name, 'delete')
                          }
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Containers
