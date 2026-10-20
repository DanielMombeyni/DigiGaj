/**
 * Smoke checks for product-card display specs (no live DB writes).
 * Run: node frontend/scripts/check-product-card-specs.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

const card = read('src/components/shop/ProductCard.jsx')
const specs = read('src/components/shop/ProductCardSpecs.jsx')
const grid = read('src/components/shop/ProductGridSection.jsx')
const home = read('src/pages/shop/HomePage.jsx')
const products = read('src/pages/shop/ProductsPage.jsx')
const detail = read('src/pages/shop/ProductDetailPage.jsx')
const admin = read('src/pages/admin/ProductsPage.jsx')

assert.match(card, /ProductCardSpecs/, 'ProductCard must render ProductCardSpecs')
assert.match(card, /product\.card_specs/, 'ProductCard must pass product.card_specs')
assert.match(card, /line-clamp-2/, 'Product name must clamp to two lines')
assert.match(card, /text-sm/, 'Mobile product name ~14px (text-sm)')
assert.match(card, /mt-auto/, 'Price/actions stay at bottom of card')

assert.match(specs, /dir="rtl"/, 'Spec rows use RTL')
assert.match(specs, /flex-col/, 'Spec rows stack vertically')
assert.match(specs, /bg-mist-50/, 'Mint row background')
assert.match(specs, /border-sea-400/, 'Sea/green border')
assert.match(specs, /unicode-bidi:isolate/, 'Bidirectional isolation')
assert.match(specs, /break-words/, 'Long labels/values wrap')
assert.doesNotMatch(specs, /dangerouslySetInnerHTML/, 'Plain text only — no HTML injection')

assert.match(grid, /<ProductCard/, 'Related/recommended grid uses ProductCard')
assert.match(home, /density="home"/, 'Homepage featured uses compact ProductCard')
assert.match(products, /<ProductCard/, 'Products/search/category page uses ProductCard')
assert.match(detail, /ProductGridSection/, 'Detail related/recommended use ProductGridSection')
assert.doesNotMatch(
  detail,
  /ProductCardSpecs/,
  'Detail page must not add a dedicated card-specs section',
)

assert.match(admin, /مشخصات نمایشی کارت/, 'Admin has Persian card-specs section')
assert.match(admin, /card_specs:/, 'Admin submit sends card_specs')
assert.match(admin, /validateCardSpecs/, 'Admin validates partial slots')

console.log('check-product-card-specs: ok')
