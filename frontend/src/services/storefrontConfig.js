import { shopApi } from '@/services/api'

const TTL_MS = 60_000

let cached = null
let inflight = null

/**
 * Shared storefront config — one network request for layout, branding, page guards.
 */
export function getStorefrontConfig({ force = false } = {}) {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return Promise.resolve(cached.data)
  }
  if (!force && inflight) return inflight

  inflight = shopApi
    .config()
    .then((r) => {
      cached = { data: r.data, at: Date.now() }
      inflight = null
      return r.data
    })
    .catch((err) => {
      inflight = null
      throw err
    })

  return inflight
}

export function peekStorefrontConfig() {
  return cached?.data ?? null
}

const CONFIG_EVENT = 'storefront-config-invalidate'
const CONFIG_STORAGE_KEY = 'storefront-config-version'

export function invalidateStorefrontConfig() {
  cached = null
  inflight = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, String(Date.now()))
    } catch {
      /* private mode / quota */
    }
  }
}

export function subscribeStorefrontConfig(onChange) {
  if (typeof window === 'undefined') return () => {}
  const onInvalidate = () => onChange()
  const onStorage = (event) => {
    if (event.key !== CONFIG_STORAGE_KEY) return
    onInvalidate()
  }
  window.addEventListener(CONFIG_EVENT, onInvalidate)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CONFIG_EVENT, onInvalidate)
    window.removeEventListener('storage', onStorage)
  }
}
