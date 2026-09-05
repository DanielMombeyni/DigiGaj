import { useEffect } from 'react'
import { getStorefrontConfig, peekStorefrontConfig, subscribeStorefrontConfig } from '@/services/storefrontConfig'
import { applyThemeToDocument, THEME_PRESETS } from '@/config/theme'

/**
 * Applies the storefront theme (and custom colors) on the whole app,
 * including the admin dashboard.
 */
export default function ThemeApplier() {
  useEffect(() => {
    let cancelled = false

    const paint = (data) => {
      applyThemeToDocument(data?.theme || 'green', data?.colors || {})
    }

    const load = async ({ force = false } = {}) => {
      try {
        const cached = peekStorefrontConfig()
        if (cached && !cancelled) paint(cached)
        // Never force on cold miss — share inflight with ShopLayout / PublicPageGuard
        const data = await getStorefrontConfig({ force })
        if (!cancelled) paint(data)
      } catch {
        if (!cancelled) applyThemeToDocument('green', THEME_PRESETS.green)
      }
    }

    load()
    const unsubscribe = subscribeStorefrontConfig(() => {
      if (!cancelled) load({ force: true }).catch(() => {})
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return null
}

export { applyThemeToDocument }
