import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ShoppingCart, Menu, X, UserRound } from 'lucide-react'
import { useCartStore } from '@/store/cart'
import { useAuthStore } from '@/store/auth'
import { getStorefrontConfig, subscribeStorefrontConfig } from '@/services/storefrontConfig'
import { faDigits } from '@/utils/format'
import { isPageEnabled } from '@/config/publicPages'
import SiteBranding from '@/components/shop/SiteBranding'
import BrandLogo from '@/components/common/BrandLogo'
import { brand } from '@/config/brand'

const nav = [
  { to: '/', label: 'خانه', pageKey: 'home' },
  { to: '/products', label: 'محصولات', pageKey: 'products' },
  { to: '/categories', label: 'دسته‌بندی‌ها', pageKey: 'categories' },
  { to: '/about', label: 'درباره ما', pageKey: 'about' },
  { to: '/contact', label: 'تماس', pageKey: 'contact' },
]

export default function ShopLayout() {
  const items = useCartStore((s) => s.items)
  const user = useAuthStore((s) => s.user)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    let cancelled = false
    const load = ({ force = false } = {}) => {
      getStorefrontConfig({ force })
        .then((data) => {
          if (!cancelled) setConfig(data)
        })
        .catch(() => {
          if (!cancelled) setConfig(null)
        })
    }
    load()
    const unsubscribe = subscribeStorefrontConfig(() => load({ force: true }))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const count = items.reduce((s, i) => s + i.quantity, 0)
  const pages = config?.pages || {}
  const visibleNav = nav.filter((item) => isPageEnabled(pages, item.pageKey))
  const showLogin = isPageEnabled(pages, 'login')
  const showRegister = isPageEnabled(pages, 'register')
  const showTerms = isPageEnabled(pages, 'cms:terms')

  return (
    <div className="flex min-h-screen flex-col">
      <SiteBranding />
      <header
        className={`sticky top-0 z-50 text-white transition duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-ink-950/95 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl'
            : 'border-b border-transparent bg-ink-950/80 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <Link to="/" className="font-display tracking-tight" onClick={() => setOpen(false)}>
            <BrandLogo size="md" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="منوی اصلی">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `cursor-pointer rounded-xl px-3.5 py-2 text-sm transition duration-200 ${
                    isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/cart"
              className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
              aria-label={`سبد خرید، ${count} قلم`}
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">سبد</span>
              {count > 0 && (
                <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-copper-500 px-1 text-[10px] font-bold">
                  {faDigits(count)}
                </span>
              )}
            </Link>
            {user ? (
              <>
                {!user.is_staff && (
                  <Link
                    to="/account"
                    className="hidden cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15 sm:inline-flex"
                  >
                    <UserRound className="h-4 w-4" strokeWidth={1.8} />
                    حساب من
                  </Link>
                )}
                {user.is_staff && (
                  <Link to="/panel-dashboard" className="hidden cursor-pointer rounded-xl bg-copper-500 px-3 py-2 text-sm font-semibold sm:inline-flex">
                    پنل
                  </Link>
                )}
                <button type="button" onClick={logout} className="hidden cursor-pointer rounded-xl px-3 py-2 text-sm text-white/70 hover:text-white sm:inline-flex">
                  خروج
                </button>
              </>
            ) : (
              <div className="hidden items-center gap-1 sm:flex">
                {showLogin && (
                  <Link to="/login" className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 hover:text-white">
                    ورود
                  </Link>
                )}
                {showRegister && (
                  <Link to="/register" className="cursor-pointer rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15">
                    ثبت‌نام
                  </Link>
                )}
              </div>
            )}
            <button
              type="button"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/10 md:hidden"
              aria-expanded={open}
              aria-label="منو"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" strokeWidth={1.8} /> : <Menu className="h-5 w-5" strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div
          className={`md:hidden overflow-hidden border-t border-white/10 bg-ink-950 transition-all duration-300 ${
            open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="flex flex-col gap-1 px-4 py-4" aria-label="منوی موبایل">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `cursor-pointer rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-white/10' : 'text-white/75 hover:bg-white/5'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user?.is_staff && (
              <Link to="/panel-dashboard" onClick={() => setOpen(false)} className="rounded-xl bg-copper-500 px-4 py-3 text-sm font-semibold">
                پنل مدیریت
              </Link>
            )}
            {user ? (
              <>
                {!user.is_staff && (
                  <Link to="/account" onClick={() => setOpen(false)} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white">
                    حساب کاربری
                  </Link>
                )}
                <button type="button" onClick={() => { logout(); setOpen(false) }} className="rounded-xl px-4 py-3 text-right text-sm text-white/70">
                  خروج
                </button>
              </>
            ) : (
              <>
                {showLogin && (
                  <Link to="/login" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm text-white/80">
                    ورود
                  </Link>
                )}
                {showRegister && (
                  <Link to="/register" onClick={() => setOpen(false)} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white">
                    ثبت‌نام
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="relative overflow-hidden border-t border-mist-200 bg-ink-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(217,119,87,0.15),transparent_50%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="font-display">
              <BrandLogo size="lg" restClass="text-white" />
            </div>
            <p className="mt-3 max-w-md text-sm leading-8 text-white/60">
              فروشگاه تخصصی گجت و لوازم دیجیتال. اصالت کالا، پرداخت امن و ارسال سریع؛ برای کسانی که انتخاب دقیق می‌خواهند.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold text-white/90">دسترسی سریع</div>
            <div className="mt-4 space-y-2.5 text-sm text-white/55">
              {visibleNav.filter((item) => item.to !== '/').map((item) => (
                <Link key={item.to} to={item.to} className="block transition hover:text-copper-400">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-white/90">پشتیبانی</div>
            <div className="mt-4 space-y-2.5 text-sm text-white/55">
              {config?.company_phone && (
                <a href={`tel:${config.company_phone}`} className="block transition hover:text-copper-400">
                  {config.company_phone}
                </a>
              )}
              {config?.company_email && (
                <a href={`mailto:${config.company_email}`} className="block break-all transition hover:text-copper-400" dir="ltr">
                  {config.company_email}
                </a>
              )}
              {config?.company_address && <p className="leading-7">{config.company_address}</p>}
              {showTerms && (
                <Link to="/pages/terms" className="block transition hover:text-copper-400">قوانین و مقررات</Link>
              )}
            </div>
            {config?.enamad_html ? (
              <div
                className="mt-5 inline-block [&_img]:max-h-16 [&_img]:w-auto"
                dangerouslySetInnerHTML={{ __html: config.enamad_html }}
              />
            ) : null}
          </div>
        </div>
        <div className="relative border-t border-white/10 py-4 text-center text-xs text-white/35">
          © {new Date().getFullYear()} {brand.name} — همه حقوق محفوظ است
        </div>
      </footer>
    </div>
  )
}
