import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function Images() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.images
      .list()
      .then(setImages)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">镜像管理</h2>

      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <table className="w-full">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="text-left p-4 text-gray-400 font-medium">别名</th>
              <th className="text-left p-4 text-gray-400 font-medium">操作系统</th>
              <th className="text-left p-4 text-gray-400 font-medium">架构</th>
              <th className="text-left p-4 text-gray-400 font-medium">大小</th>
              <th className="text-left p-4 text-gray-400 font-medium">指纹</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {images.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  暂无镜像
                </td>
              </tr>
            ) : (
              images.map((img) => (
                <tr key={img.fingerprint} className="hover:bg-gray-750">
                  <td className="p-4 font-medium">{img.alias || '-'}</td>
                  <td className="p-4">{img.os || '-'}</td>
                  <td className="p-4">{img.architecture}</td>
                  <td className="p-4">{(img.size / 1024 / 1024).toFixed(2)} MB</td>
                  <td className="p-4 text-gray-400 font-mono text-sm">
                    {img.fingerprint.slice(0, 12)}...
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

export default Images
