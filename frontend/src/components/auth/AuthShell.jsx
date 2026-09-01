import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import BrandLogo from '@/components/common/BrandLogo'
import { brand } from '@/config/brand'

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-ink-950">
      {/* Visual panel */}
      <div className="relative hidden w-[46%] flex-col justify-between p-10 lg:flex xl:w-[48%]">
        <div className="absolute inset-0 bg-hero-mesh" aria-hidden />
        <div className="absolute inset-0 hero-noise opacity-40" aria-hidden />
        <div className="pointer-events-none absolute -left-10 top-24 h-72 w-72 rounded-full bg-copper-400/25 blur-3xl animate-orb" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-64 w-64 rounded-full bg-sea-500/20 blur-3xl animate-orb-slow" />

        <Link to="/" className="relative z-10 text-white">
          <BrandLogo size="lg" restClass="text-white" />
        </Link>

        <div className="relative z-10 max-w-md animate-rise">
          <p className="text-xs font-semibold tracking-[0.2em] text-copper-400">CUSTOMER ACCOUNT</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-snug text-white xl:text-5xl">
            خرید هوشمند، تجربه ساده
          </h1>
          <p className="mt-4 text-sm leading-8 text-white/55">
            حساب مشتری برای پیگیری سفارش، سبد خرید و پرداخت امن در {brand.name}.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/70">
            {['پیگیری سفارش‌ها', 'پرداخت امن', 'پشتیبانی سریع'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-copper-500/20 text-copper-400">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/35">© {new Date().getFullYear()} {brand.name}</p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(217,119,87,0.08),transparent_50%),#f6f7f9] lg:bg-mist-50" />
        <div className="relative w-full max-w-md animate-rise">
          <div className="mb-8 text-center lg:text-right">
            <Link to="/" className="lg:hidden">
              <BrandLogo size="md" accentClass="text-copper-500" />
            </Link>
            <h2 className="mt-4 font-display text-2xl font-bold text-ink-900 md:text-3xl">{title}</h2>
            {subtitle && <p className="mt-2 text-sm leading-7 text-ink-700/55">{subtitle}</p>}
          </div>

          <div className="rounded-[1.75rem] border border-mist-200/80 bg-white p-6 shadow-soft sm:p-8">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-ink-700/55">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

export function AuthError({ message }) {
  if (!message) return null
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
      {message}
    </p>
  )
}

export function AuthSuccess({ message }) {
  if (!message) return null
  return (
    <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700" role="status">
      {message}
    </p>
  )
}

export function formatAuthError(err, fallback = 'خطایی رخ داد') {
  if (err?.code === 'ERR_NETWORK') return 'ارتباط با سرور برقرار نشد'
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data.detail === 'string') return data.detail
  if (data.errors?.detail) {
    return Array.isArray(data.errors.detail) ? data.errors.detail[0] : String(data.errors.detail)
  }
  // field errors from DRF / dj-rest-auth
  const parts = []
  const source = data.errors && typeof data.errors === 'object' ? data.errors : data
  for (const [key, val] of Object.entries(source)) {
    if (key === 'success' || key === 'detail') continue
    if (Array.isArray(val)) parts.push(val[0])
    else if (typeof val === 'string') parts.push(val)
    else if (val && typeof val === 'object') {
      for (const v of Object.values(val)) {
        if (Array.isArray(v)) parts.push(v[0])
      }
    }
  }
  return parts.filter(Boolean).join(' — ') || fallback
}
