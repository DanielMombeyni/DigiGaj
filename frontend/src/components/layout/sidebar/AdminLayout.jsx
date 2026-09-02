import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  LayoutGrid,
  TicketPercent,
  ShoppingBag,
  BarChart3,
  CreditCard,
  ArrowLeftRight,
  Settings,
  Headphones,
  Users,
  UserRound,
  Menu,
  Store,
  Mail,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import Seo from '@/components/common/Seo'
import { PANEL_BASE, PANEL_LOGIN } from '@/config/panel'
import { pathToAdminPage, firstAllowedPath } from '@/config/adminPages'
import BrandLogo from '@/components/common/BrandLogo'
import { brand } from '@/config/brand'

const iconCls = 'h-5 w-5'

const links = [
  {
    page: 'dashboard',
    to: PANEL_BASE,
    label: 'داشبورد',
    end: true,
    icon: <LayoutDashboard className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'products',
    to: `${PANEL_BASE}/products`,
    label: 'محصولات',
    icon: <Package className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'categories',
    to: `${PANEL_BASE}/categories`,
    label: 'دسته‌بندی‌ها',
    icon: <LayoutGrid className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'discounts',
    to: `${PANEL_BASE}/discounts`,
    label: 'کد تخفیف',
    icon: <TicketPercent className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'orders',
    to: `${PANEL_BASE}/orders`,
    label: 'سفارش‌ها',
    icon: <ShoppingBag className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'accounting',
    to: `${PANEL_BASE}/accounting`,
    label: 'حسابداری',
    icon: <BarChart3 className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'gateways',
    to: `${PANEL_BASE}/gateways`,
    label: 'درگاه‌ها',
    icon: <CreditCard className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'transactions',
    to: `${PANEL_BASE}/transactions`,
    label: 'تراکنش‌ها',
    icon: <ArrowLeftRight className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'tickets',
    to: `${PANEL_BASE}/tickets`,
    label: 'پشتیبانی',
    icon: <Headphones className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'storefront',
    to: `${PANEL_BASE}/storefront`,
    label: 'صفحات فروشگاه',
    icon: <Store className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'emails',
    to: `${PANEL_BASE}/emails`,
    label: 'ایمیل‌ها',
    icon: <Mail className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'customers',
    to: `${PANEL_BASE}/customers`,
    label: 'مشتریان',
    icon: <UserRound className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'personnel',
    to: `${PANEL_BASE}/personnel`,
    label: 'پرسنل',
    icon: <Users className={iconCls} strokeWidth={1.75} />,
  },
  {
    page: 'settings',
    to: `${PANEL_BASE}/settings`,
    label: 'تنظیمات',
    icon: <Settings className={iconCls} strokeWidth={1.75} />,
  },
]

const titles = {
  [PANEL_BASE]: 'داشبورد',
  [`${PANEL_BASE}/products`]: 'محصولات',
  [`${PANEL_BASE}/categories`]: 'دسته‌بندی‌ها',
  [`${PANEL_BASE}/discounts`]: 'کدهای تخفیف',
  [`${PANEL_BASE}/orders`]: 'سفارش‌ها',
  [`${PANEL_BASE}/accounting`]: 'حسابداری',
  [`${PANEL_BASE}/gateways`]: 'درگاه‌های پرداخت',
  [`${PANEL_BASE}/transactions`]: 'تراکنش‌ها',
  [`${PANEL_BASE}/tickets`]: 'تیکت‌ها و پشتیبانی',
  [`${PANEL_BASE}/storefront`]: 'صفحات فروشگاه',
  [`${PANEL_BASE}/emails`]: 'ایمیل‌ها',
  [`${PANEL_BASE}/customers`]: 'مشتریان',
  [`${PANEL_BASE}/personnel`]: 'پرسنل و نقش‌ها',
  [`${PANEL_BASE}/settings`]: 'تنظیمات فروشگاه',
}

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const booting = useAuthStore((s) => s.booting)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const allowedPages = useMemo(() => new Set(user?.admin_pages || []), [user?.admin_pages])
  const navLinks = useMemo(
    () => links.filter((l) => allowedPages.has(l.page)),
    [allowedPages],
  )

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist-100 text-sm text-ink-700/50">
        در حال بارگذاری پنل...
      </div>
    )
  }

  if (!user) return <Navigate to={PANEL_LOGIN} replace />
  if (!user.is_staff) return <Navigate to={PANEL_LOGIN} replace />

  const currentPage = pathToAdminPage(location.pathname, PANEL_BASE)
  if (currentPage && !allowedPages.has(currentPage)) {
    const fallback = firstAllowedPath(user.admin_pages, PANEL_BASE)
    if (fallback) return <Navigate to={fallback} replace />
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mist-100 px-4 text-center">
        <p className="text-sm text-ink-700/70">هیچ دسترسی‌ای برای این حساب تعریف نشده است.</p>
        <button
          type="button"
          className="btn-primary cursor-pointer"
          onClick={() => {
            logout()
            navigate(PANEL_LOGIN)
          }}
        >
          خروج و ورود مجدد
        </button>
      </div>
    )
  }

  const pageTitle = titles[location.pathname] || 'مدیریت'

  const doLogout = () => {
    logout()
    navigate(PANEL_LOGIN)
  }

  return (
    <div className="min-h-screen bg-mist-50 md:grid md:grid-cols-[260px_1fr]">
      <Seo title={`${pageTitle} — مدیریت`} path={location.pathname} noindex />

      <aside className="sticky top-0 hidden h-screen min-h-0 flex-col border-l border-mist-200/20 bg-ink-950 text-mist-50 md:flex">
        <div className="shrink-0 px-5 py-6">
          <Link to={PANEL_BASE} className="block">
            <div className="font-display text-lg font-extrabold">
              <span className="text-copper-400">پنل</span> مدیریت
            </div>
            <p className="mt-1 text-xs text-mist-50/40">{brand.name}</p>
          </Link>
        </div>
        <nav
          className="admin-sidebar-scroll flex flex-1 flex-col gap-1 px-3 pb-2"
          aria-label="منوی مدیریت"
        >
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-200 ${
                  isActive
                    ? 'bg-copper-500 text-white shadow-[0_8px_24px_rgb(var(--color-copper-500-rgb)/0.35)]'
                    : 'text-mist-50/65 hover:bg-mist-50/10 hover:text-mist-50'
                }`
              }
            >
              <span className="opacity-90">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="shrink-0 border-t border-mist-50/10 p-4">
          <div className="mb-1 truncate text-xs text-mist-50/45">{user.username}</div>
          {user.role_name && (
            <div className="mb-3 truncate text-[11px] text-mist-50/30">{user.role_name}</div>
          )}
          <div className="flex gap-2">
            <Link
              to="/"
              className="flex-1 cursor-pointer rounded-xl bg-mist-50/10 px-3 py-2 text-center text-xs text-mist-50/70 transition hover:bg-mist-50/15 hover:text-mist-50"
            >
              فروشگاه
            </Link>
            <button
              type="button"
              onClick={doLogout}
              className="flex-1 cursor-pointer rounded-xl bg-mist-50/10 px-3 py-2 text-xs text-mist-50/70 transition hover:bg-red-500/20 hover:text-red-200"
            >
              خروج
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-mist-200/80 bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-mist-100 text-ink-900 md:hidden"
                aria-label="منو"
                onClick={() => setOpen((v) => !v)}
              >
                <Menu className="h-5 w-5" strokeWidth={1.8} />
              </button>
              <div>
                <div className="text-[11px] font-medium tracking-wide text-ink-700/40">ADMIN</div>
                <div className="font-semibold text-ink-900">{pageTitle}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-mist-100 px-3 py-1.5 text-xs text-ink-700/60 sm:inline">
                {user.email || user.username}
              </span>
              <Link
                to="/"
                className="cursor-pointer rounded-xl bg-ink-950 px-3 py-2 text-xs font-semibold text-mist-50 transition hover:bg-copper-500 hover:text-white"
              >
                مشاهده فروشگاه
              </Link>
            </div>
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]"
              aria-label="بستن"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 flex w-[min(85vw,18rem)] max-w-xs flex-col bg-ink-950 text-mist-50 shadow-2xl animate-rise touch-pan-y">
              <div className="shrink-0 border-b border-mist-50/10 px-5 py-5 font-display text-lg font-bold">
                <span className="text-copper-400">پنل</span> مدیریت
              </div>
              <nav
                className="admin-sidebar-scroll flex flex-1 flex-col gap-1 px-3 py-2"
                aria-label="منوی موبایل مدیریت"
              >
                {navLinks.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                        isActive ? 'bg-copper-500 text-white' : 'text-mist-50/70 hover:bg-mist-50/10'
                      }`
                    }
                  >
                    {l.icon}
                    {l.label}
                  </NavLink>
                ))}
              </nav>
              <div className="shrink-0 space-y-2 border-t border-mist-50/10 p-4">
                <div className="truncate text-xs text-mist-50/45">{user.username}</div>
                <Link
                  to="/"
                  className="block cursor-pointer rounded-xl bg-mist-50/10 py-3 text-center text-sm text-mist-50/70 transition hover:bg-mist-50/15"
                >
                  فروشگاه
                </Link>
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-xl bg-mist-50/10 py-3 text-sm text-mist-50/70 transition hover:bg-red-500/20 hover:text-red-200"
                  onClick={doLogout}
                >
                  خروج
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
