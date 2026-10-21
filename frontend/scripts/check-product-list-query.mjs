/**
 * Safe, DB-free smoke checks for product list URL helpers.
 * Run: node scripts/check-product-list-query.mjs
 */
import {
  buildProductListParams,
  parseFeaturedParam,
  parseInStockParam,
  parseListParam,
} from '../src/utils/productListQuery.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(parseFeaturedParam('true') === true, 'true')
assert(parseFeaturedParam('1') === true, '1')
assert(parseFeaturedParam('yes') === true, 'yes')
assert(parseFeaturedParam('false') === false, 'false')
assert(parseFeaturedParam(null) === false, 'null')

assert(parseInStockParam('true') === 'true', 'in_stock true')
assert(parseInStockParam('0') === 'false', 'in_stock 0 → false')
assert(parseInStockParam('') === '', 'in_stock empty')
assert(parseInStockParam(null) === '', 'in_stock null')

assert(JSON.stringify(parseListParam('a, b ,,a')) === JSON.stringify(['a', 'b']), 'parseListParam dedupe')
assert(JSON.stringify(parseListParam(null)) === JSON.stringify([]), 'parseListParam null')

const withFeatured = buildProductListParams({
  search: 'هدفون',
  category: '3',
  featured: true,
  page: 2,
})
assert(withFeatured.get('is_featured') === 'true', 'featured in URL')
assert(withFeatured.get('search') === 'هدفون', 'search')
assert(withFeatured.get('category') === '3', 'category')
assert(withFeatured.get('page') === '2', 'page')

const cleared = buildProductListParams({ featured: false, page: 1 })
assert(cleared.get('is_featured') === null, 'featured omitted when false')
assert(cleared.get('page') === null, 'page 1 omitted')
assert(cleared.get('brand') === null, 'brand omitted when empty')
assert(cleared.get('colors') === null, 'colors omitted when empty')
assert(cleared.get('in_stock') === null, 'in_stock omitted when empty')

const withFacets = buildProductListParams({
  brand: 'Samsung',
  colors: ['#ff0000', '#00ff00'],
  inStock: 'true',
})
assert(withFacets.get('brand') === 'Samsung', 'brand in URL')
assert(withFacets.get('colors') === '#ff0000,#00ff00', 'colors in URL')
assert(withFacets.get('in_stock') === 'true', 'in_stock in URL')

console.log('check-product-list-query: OK')
