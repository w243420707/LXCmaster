function Settings() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">系统设置</h2>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">关于</h3>
        <div className="space-y-2 text-gray-300">
          <p><span className="text-gray-400">版本:</span> 1.0.0</p>
          <p><span className="text-gray-400">后端:</span> Go + Gin</p>
          <p><span className="text-gray-400">前端:</span> React + Vite + TailwindCSS</p>
          <p><span className="text-gray-400">容器技术:</span> Incus</p>
        </div>
      </div>
    </div>
  )
}

export default Settings
