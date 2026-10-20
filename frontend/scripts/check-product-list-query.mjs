/**
 * Safe, DB-free smoke checks for product list URL helpers.
 * Run: node scripts/check-product-list-query.mjs
 */
import {
  buildProductListParams,
  parseFeaturedParam,
} from '../src/utils/productListQuery.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(parseFeaturedParam('true') === true, 'true')
assert(parseFeaturedParam('1') === true, '1')
assert(parseFeaturedParam('yes') === true, 'yes')
assert(parseFeaturedParam('false') === false, 'false')
assert(parseFeaturedParam(null) === false, 'null')

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

console.log('check-product-list-query: OK')
