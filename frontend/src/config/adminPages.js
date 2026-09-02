export const ADMIN_PAGES = [
  { key: 'dashboard', label: 'داشبورد', path: '' },
  { key: 'products', label: 'محصولات', path: '/products' },
  { key: 'categories', label: 'دسته‌بندی‌ها', path: '/categories' },
  { key: 'discounts', label: 'کد تخفیف', path: '/discounts' },
  { key: 'orders', label: 'سفارش‌ها', path: '/orders' },
  { key: 'accounting', label: 'حسابداری', path: '/accounting' },
  { key: 'gateways', label: 'درگاه‌ها', path: '/gateways' },
  { key: 'transactions', label: 'تراکنش‌ها', path: '/transactions' },
  { key: 'tickets', label: 'پشتیبانی', path: '/tickets' },
  { key: 'settings', label: 'تنظیمات', path: '/settings' },
  { key: 'personnel', label: 'پرسنل و نقش‌ها', path: '/personnel' },
  { key: 'customers', label: 'مشتریان', path: '/customers' },
  { key: 'storefront', label: 'صفحات فروشگاه', path: '/storefront' },
  { key: 'emails', label: 'ایمیل‌ها', path: '/emails' },
]

/** Map pathname under panel to page key */
export function pathToAdminPage(pathname, panelBase) {
  const base = panelBase.replace(/\/$/, '')
  if (pathname === base || pathname === `${base}/`) return 'dashboard'
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname
  const seg = rest.replace(/^\//, '').split('/')[0]
  const hit = ADMIN_PAGES.find((p) => p.path === `/${seg}`)
  return hit?.key || null
}

export function firstAllowedPath(adminPages, panelBase) {
  const set = new Set(adminPages || [])
  const page = ADMIN_PAGES.find((p) => set.has(p.key))
  if (!page) return null
  return page.path ? `${panelBase}${page.path}` : panelBase
}
