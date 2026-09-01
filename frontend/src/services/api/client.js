import axios from 'axios'
import { config } from '@/config'

const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': config.platform,
  },
})

api.interceptors.request.use((req) => {
  const url = req.url || ''
  const skipBearer =
    (url.includes('/auth/token/') && !url.includes('/auth/token/refresh/')) ||
    url.includes('/auth/registration/') ||
    url.includes('/auth/password/reset')
  if (!skipBearer) {
    const token = localStorage.getItem('access_token')
    if (token) {
      req.headers.Authorization = `Bearer ${token}`
    }
  }
  // Let the browser set multipart boundary for FormData
  if (typeof FormData !== 'undefined' && req.data instanceof FormData) {
    if (req.headers && 'Content-Type' in req.headers) {
      delete req.headers['Content-Type']
    }
  }
  return req
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${config.apiBaseUrl.replace(/\/$/, '')}/auth/token/refresh/`,
            { refresh },
          )
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      }
    }
    return Promise.reject(error)
  },
)

export default api
