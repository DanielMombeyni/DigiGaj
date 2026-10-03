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
  const existing = [...document.head.querySelectorAll(`link[rel="${rel}"]`)]
  let link = existing[0]
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', rel)
    document.head.appendChild(link)
  }
  // Drop duplicate icon tags so the uploaded site icon wins everywhere.
  existing.slice(1).forEach((node) => node.remove())
  link.setAttribute('href', href)
  if (type) link.setAttribute('type', type)
  else link.removeAttribute('type')
}

function applySiteIcon(icon) {
  if (!icon) return
  const href = mediaSrc(icon) || icon
  const absolute = href.startsWith('http') || href.startsWith('data:')
    ? href
    : `${window.location.origin}${href.startsWith('/') ? '' : '/'}${href}`
  const bust = absolute.includes('?') ? `${absolute}&v=${Date.now()}` : `${absolute}?v=${Date.now()}`
  const lower = String(icon).toLowerCase()
  const type = lower.endsWith('.svg')
    ? 'image/svg+xml'
    : lower.endsWith('.ico')
      ? 'image/x-icon'
      : lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
            ? 'image/jpeg'
            : undefined
  upsertLink('icon', bust, type)
  upsertLink('shortcut icon', bust, type)
  upsertLink('apple-touch-icon', bust)
  persistAppearance({ site_icon: absolute })
}

/**
 * Applies favicon / apple-touch icons from storefront config app-wide
 * (home, about, contact, login, panel, …).
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
