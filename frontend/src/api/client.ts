import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────
export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
}

// ── Stocks ────────────────────────────────────────────────────────────
export const stocksAPI = {
  search: (query: string, market: string) =>
    api.get('/stocks/search', { params: { query, market } }),
  info: (ticker: string, market: string) =>
    api.get(`/stocks/info/${ticker}`, { params: { market } }),
  history: (ticker: string, market: string, period: string) =>
    api.get(`/stocks/history/${ticker}`, { params: { market, period } }),
  saveStock: (ticker: string, market: string) =>
    api.post('/stocks/saved', { ticker, market }),
  getSaved: () => api.get('/stocks/saved'),
  deleteSaved: (id: string) => api.delete(`/stocks/saved/${id}`),
}

// ── Research ──────────────────────────────────────────────────────────
export const researchAPI = {
  start: (ticker: string, market: string, period: string) =>
    api.post('/research/start', { ticker, market, period }),
  status: (taskId: string) => api.get(`/research/status/${taskId}`),
  result: (taskId: string) => api.get(`/research/${taskId}`),
  history: () => api.get('/research/history/all'),
}
