const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed (${response.status})`)
  }
  return payload
}

export const api = {
  health: () => request('/api/health'),
  overview: () => request('/api/overview'),
  scenarios: () => request('/api/scenarios'),
  network: () => request('/api/network'),
  runs: () => request('/api/runs'),
  runDetail: (runId) => request(`/api/runs/${encodeURIComponent(runId)}`),
  audit: () => request('/api/audit'),
  run: (body) => request('/api/run', { method: 'POST', body: JSON.stringify(body) }),
}

export const money = (value) => value == null ? '—' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(value)

export const number = (value) => new Intl.NumberFormat('en-IN').format(value || 0)
