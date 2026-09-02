import { useEffect } from 'react'
import { getStorefrontConfig } from '@/services/storefrontConfig'
import { mediaSrc } from '@/utils/media'

function upsertLink(rel, href, type) {
  if (!href) return
  let link = document.head.querySelector(`link[rel="${rel}"]`)
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', rel)
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
  if (type) link.setAttribute('type', type)
  else link.removeAttribute('type')
}

export default function SiteBranding() {
  useEffect(() => {
    let cancelled = false
    getStorefrontConfig()
      .then((data) => {
        if (cancelled) return
        const icon = data?.site_icon
        if (!icon) return
        const lower = icon.toLowerCase()
        const type = lower.endsWith('.svg')
          ? 'image/svg+xml'
          : lower.endsWith('.ico')
            ? 'image/x-icon'
            : undefined
        upsertLink('icon', mediaSrc(icon) || icon, type)
        upsertLink('shortcut icon', mediaSrc(icon) || icon, type)
        upsertLink('apple-touch-icon', mediaSrc(icon) || icon)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
