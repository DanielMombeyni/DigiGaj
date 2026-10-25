import { useEffect } from 'react'
import { brand } from '@/config/brand'
import { mediaSrc } from '@/utils/media'
import { readAppearance } from '@/config/theme'
import { peekStorefrontConfig } from '@/services/storefrontConfig'

const DEFAULT_DESC = brand.defaultDescription

/**
 * Lightweight SEO head manager (no extra dependency).
 */
export default function Seo({
  title,
  description = DEFAULT_DESC,
  path = '/',
  image,
  type = 'website',
  jsonLd,
  noindex = false,
  productMetadata,
}) {
  const fullTitle = title ? `${title} | ${brand.name}` : brand.defaultTitle
  const url = productMetadata?.url || (typeof window !== 'undefined' ? `${window.location.origin}${path}` : path)
  const fallbackIcon = type === 'product' ? '' : (
    peekStorefrontConfig()?.site_icon || readAppearance()?.site_icon || ''
  )
  const siteIcon = image || fallbackIcon

  useEffect(() => {
    document.head.querySelectorAll('[data-product-meta]').forEach((el) => el.remove())
    if (productMetadata) {
      const values = {
        product_id: productMetadata.product_id,
        product_name: productMetadata.product_name,
        product_price: productMetadata.price,
        product_old_price: productMetadata.old_price,
        availability: productMetadata.availability,
        guarantee: productMetadata.guarantee,
      }
      Object.entries(values).forEach(([key, value]) => {
        if (value == null || value === '') return
        const el = document.createElement('meta')
        el.name = key
        el.content = String(value)
        el.setAttribute('data-product-meta', '')
        document.head.appendChild(el)
      })
    }
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
    if (siteIcon) {
      const ogImage = mediaSrc(siteIcon) || siteIcon
      upsert(
        'property',
        'og:image',
        ogImage.startsWith('http') ? ogImage : `${window.location.origin}${ogImage}`,
      )
    } else {
      document.head.querySelector('meta[property="og:image"]')?.remove()
    }
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
    return () => {
      document.head.querySelectorAll('[data-product-meta]').forEach((el) => el.remove())
    }
  }, [fullTitle, description, url, image, type, jsonLd, noindex, productMetadata])

  return null
}

export function organizationJsonLd(contact = {}) {
  const point = {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: ['Persian', 'fa'],
  }
  if (contact.email) point.email = contact.email
  if (contact.phone) point.telephone = contact.phone

  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    url: typeof window !== 'undefined' ? window.location.origin : '',
    logo: typeof window !== 'undefined' ? `${window.location.origin}/vite.svg` : '/vite.svg',
  }
  if (contact.email || contact.phone) org.contactPoint = point
  if (contact.address) {
    org.address = {
      '@type': 'PostalAddress',
      streetAddress: contact.address,
      addressCountry: 'IR',
    }
  }
  return org
}

export function productJsonLd(product) {
  if (!product) return null
  const metadata = product.crawler_metadata
  const onRequest = Boolean(product.price_on_request) || Number(product.price_toman) === 0
  const offer = {
    '@type': 'Offer',
    priceCurrency: 'IRR',
    availability: (metadata ? metadata.availability === 'instock' : product.in_stock)
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
  }
  if (metadata ? metadata.price != null : !onRequest) {
    offer.price = String(Number(metadata ? metadata.price : product.price_toman || 0) * 10)
  }
  if (metadata) offer.url = metadata.url
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_description || product.description || product.name,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    image: (metadata ? metadata.image : product.primary_image) || undefined,
    offers: offer,
  }
}
