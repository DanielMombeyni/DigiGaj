import { useEffect, useRef } from 'react'

import { useLocation } from 'react-router-dom'

import { getStorefrontConfig, peekStorefrontConfig } from '@/services/storefrontConfig'

import { applyThemeToDocument, THEME_PRESETS } from '@/config/theme'

import { PANEL_BASE } from '@/config/panel'



const CONFIG_EVENT = 'storefront-config-invalidate'

const CONFIG_STORAGE_KEY = 'storefront-config-version'



/**

 * Loads public storefront theme/colors and applies CSS variables on <html>.

 * Admin panel always stays on classic tokens.

 */

export default function ThemeApplier() {

  const location = useLocation()

  const isAdmin = location.pathname.startsWith(PANEL_BASE)

  const wasAdminRef = useRef(isAdmin)



  useEffect(() => {

    const applyFromConfig = (data, { forceFetch = false } = {}) => {

      if (!data || forceFetch) {

        return getStorefrontConfig({ force: true }).then((fresh) => {

          applyThemeToDocument(fresh?.theme || 'classic', fresh?.colors || {})

        })

      }

      applyThemeToDocument(data.theme || 'classic', data.colors || {})

      return Promise.resolve()

    }



    const leftAdmin = wasAdminRef.current && !isAdmin

    wasAdminRef.current = isAdmin



    if (isAdmin) {

      applyThemeToDocument('classic', THEME_PRESETS.classic)

      return undefined

    }



    let cancelled = false



    const run = async () => {

      try {

        const cached = leftAdmin ? null : peekStorefrontConfig()

        if (cached && !cancelled) {

          applyThemeToDocument(cached.theme || 'classic', cached.colors || {})

        }

        const data = await getStorefrontConfig({ force: leftAdmin || !cached })

        if (!cancelled) {

          applyThemeToDocument(data?.theme || 'classic', data?.colors || {})

        }

      } catch {

        if (!cancelled) {

          applyThemeToDocument('classic', THEME_PRESETS.classic)

        }

      }

    }



    run()



    const onInvalidate = () => {

      if (cancelled || isAdmin) return

      applyFromConfig(null, { forceFetch: true }).catch(() => {})

    }



    const onStorage = (event) => {

      if (event.key !== CONFIG_STORAGE_KEY) return

      onInvalidate()

    }



    window.addEventListener(CONFIG_EVENT, onInvalidate)

    window.addEventListener('storage', onStorage)



    return () => {

      cancelled = true

      window.removeEventListener(CONFIG_EVENT, onInvalidate)

      window.removeEventListener('storage', onStorage)

    }

  }, [isAdmin, location.pathname])



  return null

}



export { applyThemeToDocument }


