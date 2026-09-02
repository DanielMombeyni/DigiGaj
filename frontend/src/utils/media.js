/**
 * Same-origin media path. Strips localhost / http hosts so HTTPS pages
 * never request Mixed Content for uploaded files.
 */
export function mediaSrc(url) {
  if (!url) return ''
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return url
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/media/')) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    return url
  }
  return url
}
