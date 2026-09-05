import { NavLink, Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import {
  ShoppingBag,
  ArrowLeftRight,
  Headphones,
  MapPin,
  UserRound,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { PANEL_BASE } from '@/config/panel'
import Seo from '@/components/common/Seo'
import LoadingScreen from '@/components/common/LoadingScreen'

const iconCls = 'h-5 w-5'

const links = [
  { to: '/account/orders', label: 'سفارش‌ها', icon: <ShoppingBag className={iconCls} strokeWidth={1.75} /> },
  { to: '/account/transactions', label: 'تراکنش‌ها', icon: <ArrowLeftRight className={iconCls} strokeWidth={1.75} /> },
  { to: '/account/tickets', label: 'پشتیبانی', icon: <Headphones className={iconCls} strokeWidth={1.75} /> },
  { to: '/account/addresses', label: 'آدرس‌ها', icon: <MapPin className={iconCls} strokeWidth={1.75} /> },
  { to: '/account/profile', label: 'پروفایل', icon: <UserRound className={iconCls} strokeWidth={1.75} /> },
]

const titles = {
  '/account/orders': 'سفارش‌های من',
  '/account/transactions': 'تراکنش‌های من',
  '/account/tickets': 'پشتیبانی',
  '/account/addresses': 'آدرس‌ها',
  '/account/profile': 'پروفایل',
}

export default function AccountLayout() {
  const user = useAuthStore((s) => s.user)
  const booting = useAuthStore((s) => s.booting)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const location = useLocation()

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  if (booting) {
    return <LoadingScreen variant="page" label="در حال ورود به حساب کاربری..." />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user.is_staff) {
    return <Navigate to={PANEL_BASE} replace />
  }

  const pageTitle =
    titles[location.pathname] ||
    (location.pathname.startsWith('/account/orders/') ? 'جزئیات سفارش' : 'حساب کاربری')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <Seo title={pageTitle} path={location.pathname} noindex />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-copper-600">MY ACCOUNT</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">حساب کاربری</h1>
          <p className="mt-2 text-sm text-ink-700/60">
            سلام {user.first_name || user.username} — سفارش‌ها، تراکنش‌ها و پشتیبانی
          </p>
        </div>
        <Link to="/products" className="btn-dark cursor-pointer text-xs">
          ادامه خرید
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="منوی حساب کاربری"
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-ink-950 text-white shadow-soft'
                    : 'border border-mist-200 bg-white text-ink-700/70 hover:border-copper-400/30 hover:bg-mist-50'
                }`
              }
            >
              {l.icon}
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
