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
      applyThemeToDocument(data?.theme || 'classic', data?.colors || {})
    }

    const load = async ({ force = false } = {}) => {
      try {
        const cached = !force ? peekStorefrontConfig() : null
        if (cached && !cancelled) paint(cached)
        const data = await getStorefrontConfig({ force: force || !cached })
        if (!cancelled) paint(data)
      } catch {
        if (!cancelled) applyThemeToDocument('classic', THEME_PRESETS.classic)
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
