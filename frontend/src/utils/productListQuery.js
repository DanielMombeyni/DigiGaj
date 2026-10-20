/**
 * Pure helpers for /products list URL ↔ filter state (no React).
 * Kept separate so URL sync can be checked without a browser test runner.
 */

export function parseFeaturedParam(raw) {
  const v = String(raw || '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

export function buildProductListParams({
  search = '',
  category = '',
  minPrice = '',
  maxPrice = '',
  ordering = '',
  page = 1,
  featured = false,
} = {}) {
  const next = new URLSearchParams()
  if (search) next.set('search', search)
  if (category) next.set('category', category)
  if (minPrice) next.set('min_price', minPrice)
  if (maxPrice) next.set('max_price', maxPrice)
  if (ordering) next.set('ordering', ordering)
  if (featured) next.set('is_featured', 'true')
  if (page && Number(page) > 1) next.set('page', String(page))
  return next
}
