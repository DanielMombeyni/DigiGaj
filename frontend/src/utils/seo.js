/** Keep public canonical URLs on the configured storefront origin. */
export function canonicalUrl(siteUrl, path = '/') {
  const base = new URL(siteUrl)
  const target = new URL(path, base)
  target.protocol = base.protocol
  target.host = base.host
  target.hash = ''
  for (const key of [...target.searchParams.keys()]) {
    if (/^(utm_|gclid$|fbclid$|msclkid$)/i.test(key)) target.searchParams.delete(key)
  }
  return target.href
}
