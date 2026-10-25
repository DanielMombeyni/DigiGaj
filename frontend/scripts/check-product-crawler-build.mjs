/** Production shell/proxy contract for Django product HTML; no files emitted. */
import assert from 'node:assert/strict'
import { build } from 'vite'
import config from '../vite.config.js'

const result = await build({
  ...config,
  configFile: false,
  build: { ...config.build, write: false },
})
const html = result.output.find((item) => item.fileName === 'index.html')?.source
for (const marker of ['<!-- product-seo:start -->', '<!-- product-seo:end -->']) {
  assert.equal(html?.split(marker).length, 2, `Expected one ${marker}`)
}

const route = Object.keys(config.server.proxy).find((key) => key.startsWith('^/'))
assert.ok(route, 'Missing document/discovery proxy')
const regex = new RegExp(route)
for (const url of [
  '/products/example', '/products/example/', '/products/%DA%A9%D8%A7%D9%84%D8%A7',
  '/sitemap.xml', '/sitemap-products.xml?p=2', '/robots.txt',
]) {
  assert.ok(regex.test(url), `Missing public route: ${url}`)
}
for (const url of ['/products', '/index.html', '/src/main.jsx', '/api/v1/products/']) {
  assert.ok(!regex.test(url), `Proxy loop or unrelated route intercepted: ${url}`)
}
console.log('check-product-crawler-build: OK (in-memory production build)')
