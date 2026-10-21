/**
 * Pure helpers for /products list URL ↔ filter state (no React).
 * Kept separate so URL sync can be checked without a browser test runner.
 */

export function parseFeaturedParam(raw) {
  const v = String(raw || '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/** `''` | `'true'` | `'false'` — normalize the in_stock URL param. */
export function parseInStockParam(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return 'true'
  if (v === 'false' || v === '0' || v === 'no') return 'false'
  return ''
}

/** Split a comma list param into a clean array (order preserved, de-duped). */
export function parseListParam(raw) {
  const seen = new Set()
  const out = []
  for (const part of String(raw || '').split(',')) {
    const v = part.trim()
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

export function buildProductListParams({
  search = '',
  category = '',
  minPrice = '',
  maxPrice = '',
  ordering = '',
  page = 1,
  featured = false,
  brand = '',
  colors = [],
  inStock = '',
} = {}) {
  const next = new URLSearchParams()
  if (search) next.set('search', search)
  if (category) next.set('category', category)
  if (minPrice) next.set('min_price', minPrice)
  if (maxPrice) next.set('max_price', maxPrice)
  if (ordering) next.set('ordering', ordering)
  if (featured) next.set('is_featured', 'true')
  if (brand) next.set('brand', brand)
  if (Array.isArray(colors) && colors.length) next.set('colors', colors.join(','))
  if (inStock === 'true' || inStock === 'false') next.set('in_stock', inStock)
  if (page && Number(page) > 1) next.set('page', String(page))
  return next
}
