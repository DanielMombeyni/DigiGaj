import { useEffect } from 'react'
import {
  getStorefrontConfig,
  peekStorefrontConfig,
  subscribeStorefrontConfig,
} from '@/services/storefrontConfig'
import { mediaSrc } from '@/utils/media'
import { persistAppearance, readAppearance } from '@/config/theme'

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

function applySiteIcon(icon) {
  if (!icon) return
  const href = mediaSrc(icon) || icon
  const bust = href.includes('?') ? `${href}&v=${Date.now()}` : `${href}?v=${Date.now()}`
  const lower = String(icon).toLowerCase()
  const type = lower.endsWith('.svg')
    ? 'image/svg+xml'
    : lower.endsWith('.ico')
      ? 'image/x-icon'
      : undefined
  upsertLink('icon', bust, type)
  upsertLink('shortcut icon', bust, type)
  upsertLink('apple-touch-icon', bust)
  persistAppearance({ site_icon: href })
}

/**
 * Applies favicon / apple-touch icons from storefront config app-wide.
 * Re-runs whenever config is invalidated so a new upload replaces the old icon everywhere.
 */
export default function SiteBranding() {
  useEffect(() => {
    let cancelled = false

    const cachedIcon = readAppearance()?.site_icon
    if (cachedIcon) applySiteIcon(cachedIcon)

    const paint = (data) => {
      if (cancelled) return
      const icon = data?.site_icon
      if (icon) applySiteIcon(icon)
    }

    const load = async ({ force = false } = {}) => {
      try {
        const peek = peekStorefrontConfig()
        if (peek) paint(peek)
        const data = await getStorefrontConfig({ force })
        paint(data)
      } catch {
        /* keep cached icon */
      }
    }

    load()
    const unsubscribe = subscribeStorefrontConfig(() => {
      if (!cancelled) load({ force: true })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return null
}
