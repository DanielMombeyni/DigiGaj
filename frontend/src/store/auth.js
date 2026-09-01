import { create } from 'zustand'
import { authApi } from '@/services/api'

function persistTokens(access, refresh) {
  if (access) localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
}

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,
  booting: true,

  async applySession({ access, refresh, user } = {}) {
    persistTokens(access, refresh)
    if (user) {
      set({ user, loading: false, booting: false })
      return user
    }
    const { data } = await authApi.me()
    set({ user: data, loading: false, booting: false })
    return data
  },

  async login(username, password, { requireStaff = false } = {}) {
    set({ loading: true })
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    try {
      const { data } = await authApi.login(username, password)
      const access = data.access || data.access_token
      const refresh = data.refresh || data.refresh_token
      if (!access) throw new Error('No access token')
      persistTokens(access, refresh)
      const me = data.user ? { data: data.user } : await authApi.me()
      const user = me.data || me
      if (requireStaff && !user.is_staff) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, loading: false })
        const err = new Error('NOT_STAFF')
        err.code = 'NOT_STAFF'
        throw err
      }
      set({ user, loading: false, booting: false })
      return user
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  async loginWithOtp(phone, code) {
    set({ loading: true })
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    try {
      const { data } = await authApi.verifyOtp(phone, code)
      const access = data.access
      const refresh = data.refresh
      if (!access) throw new Error('No access token')
      persistTokens(access, refresh)
      const { data: user } = await authApi.me()
      set({ user, loading: false, booting: false })
      return user
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  async fetchMe() {
    if (!localStorage.getItem('access_token')) {
      set({ user: null, booting: false })
      return null
    }
    try {
      const { data } = await authApi.me()
      set({ user: data, booting: false })
      return data
    } catch {
      set({ user: null, booting: false })
      return null
    }
  },

  logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, booting: false })
  },
}))
