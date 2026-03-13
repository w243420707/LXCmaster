const API_BASE = '/api'

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

export const api = {
  containers: {
    list: () => fetchAPI('/containers'),
    get: (name) => fetchAPI(`/containers/${name}`),
    create: (data) => fetchAPI('/containers', { method: 'POST', body: JSON.stringify(data) }),
    update: (name, data) => fetchAPI(`/containers/${name}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (name) => fetchAPI(`/containers/${name}`, { method: 'DELETE' }),
    start: (name) => fetchAPI(`/containers/${name}/start`, { method: 'POST' }),
    stop: (name) => fetchAPI(`/containers/${name}/stop`, { method: 'POST' }),
    restart: (name) => fetchAPI(`/containers/${name}/restart`, { method: 'POST' }),
    ports: {
      list: (name) => fetchAPI(`/containers/${name}/ports`),
      add: (name, data) => fetchAPI(`/containers/${name}/ports`, { method: 'POST', body: JSON.stringify(data) }),
      delete: (name, port) => fetchAPI(`/containers/${name}/ports/${port}`, { method: 'DELETE' }),
    },
  },
  images: {
    list: () => fetchAPI('/images'),
  },
  networks: {
    list: () => fetchAPI('/networks'),
  },
  storage: {
    list: () => fetchAPI('/storage'),
  },
}
