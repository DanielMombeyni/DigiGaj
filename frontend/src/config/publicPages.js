/** Map storefront routes to public page keys from API config.pages */
export function routeToPageKey(pathname) {
  if (!pathname || pathname === '/') return 'home'
  if (pathname.startsWith('/products')) return 'products'
  if (pathname.startsWith('/categories')) return 'categories'
  if (pathname === '/about') return 'about'
  if (pathname === '/contact') return 'contact'
  if (pathname.startsWith('/pages/')) {
    const slug = pathname.replace(/^\/pages\//, '').split('/')[0]
    return slug ? `cms:${slug}` : null
  }
  if (pathname === '/cart') return 'cart'
  if (pathname === '/login') return 'login'
  if (pathname === '/register') return 'register'
  return null
}

export function isPageEnabled(pages, pageKey) {
  if (!pageKey) return true
  if (!pages || typeof pages !== 'object') return true
  return pages[pageKey] !== false
}
