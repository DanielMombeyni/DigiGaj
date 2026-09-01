import { useEffect } from 'react'
import { brand } from '@/config/brand'

const DEFAULT_DESC = brand.defaultDescription

/**
 * Lightweight SEO head manager (no extra dependency).
 */
export default function Seo({
  title,
  description = DEFAULT_DESC,
  path = '/',
  image = '/vite.svg',
  type = 'website',
  jsonLd,
  noindex = false,
}) {
  const fullTitle = title ? `${title} | ${brand.name}` : brand.defaultTitle
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path

  useEffect(() => {
    document.title = fullTitle

    const upsert = (attr, key, content) => {
      if (!content) return
      let el = document.head.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    upsert('name', 'description', description)
    upsert('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow')
    upsert('property', 'og:title', fullTitle)
    upsert('property', 'og:description', description)
    upsert('property', 'og:type', type)
    upsert('property', 'og:url', url)
    upsert('property', 'og:image', image.startsWith('http') ? image : `${window.location.origin}${image}`)
    upsert('property', 'og:locale', 'fa_IR')
    upsert('property', 'og:site_name', brand.name)
    upsert('name', 'twitter:card', 'summary_large_image')
    upsert('name', 'twitter:title', fullTitle)
    upsert('name', 'twitter:description', description)

    let link = document.head.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', url)

    const scriptId = 'seo-jsonld'
    let script = document.getElementById(scriptId)
    if (jsonLd) {
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.type = 'application/ld+json'
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(jsonLd)
    } else if (script) {
      script.remove()
    }
  }, [fullTitle, description, url, image, type, jsonLd, noindex])

  return null
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    url: typeof window !== 'undefined' ? window.location.origin : '',
    logo: typeof window !== 'undefined' ? `${window.location.origin}/vite.svg` : '/vite.svg',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@gadgetstore.local',
      availableLanguage: ['Persian', 'fa'],
    },
  }
}

export function productJsonLd(product) {
  if (!product) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_description || product.description || product.name,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    image: product.primary_image || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IRR',
      price: String(product.price_toman * 10),
      availability: product.in_stock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }
}
