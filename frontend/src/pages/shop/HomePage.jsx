import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Truck, CreditCard, ShieldCheck, CircleHelp, ChevronDown } from 'lucide-react'
import { shopApi } from '@/services/api'
import { ProductCard } from '@/components/shop/ProductCard'
import Seo, { organizationJsonLd } from '@/components/common/Seo'
import BrandLogo from '@/components/common/BrandLogo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { mediaSrc } from '@/utils/media'

const BENEFITS = [
  {
    title: 'ارسال سریع',
    text: 'ارسال به سراسر کشور با بسته‌بندی ایمن مخصوص گجت',
    icon: <Truck className="h-6 w-6" strokeWidth={1.75} />,
  },
  {
    title: 'پرداخت امن',
    text: 'درگاه‌های معتبر و امکان کارت‌به‌کارت با تأیید ادمین',
    icon: <CreditCard className="h-6 w-6" strokeWidth={1.75} />,
  },
  {
    title: 'گارانتی معتبر',
    text: 'محصولات با ضمانت اصالت و پشتیبانی واقعی',
    icon: <ShieldCheck className="h-6 w-6" strokeWidth={1.75} />,
  },
  {
    title: 'مشاوره تخصصی',
    text: 'کمک برای انتخاب درست قبل از خرید',
    icon: <CircleHelp className="h-6 w-6" strokeWidth={1.75} />,
  },
]

const STEPS = [
  { n: '۰۱', t: 'انتخاب گجت', d: 'از میان دسته‌بندی‌ها و محصولات ویژه' },
  { n: '۰۲', t: 'ثبت سفارش', d: 'آدرس و کد تخفیف را وارد کنید' },
  { n: '۰۳', t: 'پرداخت امن', d: 'درگاه آنلاین یا کارت‌به‌کارت' },
  { n: '۰۴', t: 'دریافت سریع', d: 'پیگیری سفارش تا لحظه تحویل' },
]

function SkeletonGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl bg-mist-100" />
      ))}
    </div>
  )
}

export default function HomePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    shopApi
      .home()
      .then((r) => {
        if (!cancelled) setData(r.data)
      })
      .catch(() => {
        if (!cancelled) setData({ featured_products: [], categories: [], banners: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const settings = data?.settings?.store || {}
  const heroTitle = settings.hero_glass_title || 'اتمسفر دیجیتال'
  const heroSubtitle = settings.hero_glass_subtitle || 'تجربه خرید گجت، متفاوت'
  const heroImage = settings.hero_glass_image || null
  const featured = data?.featured_products || []
  const categories = data?.categories || []
  const company = data?.config || {}

  return (
    <div>
      <Seo
        title="خانه"
        description={
          settings.tagline ||
          'خرید و فروش تخصصی گجت‌های روز — هدفون، ساعت هوشمند، لوازم موبایل و گیمینگ'
        }
        path="/"
        jsonLd={[
          organizationJsonLd({
            email: company.company_email,
            phone: company.company_phone,
            address: company.company_address,
          }),
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: brand.name,
            url: typeof window !== 'undefined' ? window.location.origin : '',
            potentialAction: {
              '@type': 'SearchAction',
              target: `${typeof window !== 'undefined' ? window.location.origin : ''}/products?search={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />

      {/* Hero — full-bleed, brand-first */}
      <section className="relative min-h-[88vh] overflow-hidden bg-hero-mesh text-white">
        <div className="hero-noise absolute inset-0 opacity-[0.35]" aria-hidden />
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-copper-400/20 blur-3xl animate-orb" />
          <div className="absolute -left-20 bottom-10 h-[22rem] w-[22rem] rounded-full bg-sea-500/25 blur-3xl animate-orb-slow" />
          <div className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-white/5 blur-2xl animate-pulse-soft" />
        </div>

        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 md:justify-center md:pb-24 md:pt-20">
          <div className="max-w-xl animate-rise">
            <BrandLogo size="hero" className="block" restClass="text-white" />
            <h1 className="mt-5 text-xl font-medium leading-9 text-white/90 md:text-2xl md:leading-10">
              {settings.tagline || 'تکنولوژی روز، انتخاب مطمئن'}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/60 md:text-base md:leading-8">
              از هدفون و ساعت هوشمند تا لوازم گیمینگ — خرید امن، ارسال سریع، پشتیبانی واقعی.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/products" className="btn-primary min-h-11 cursor-pointer px-7">
                مشاهده محصولات
              </Link>
              <Link to="/categories" className="btn-ghost min-h-11 cursor-pointer">
                دسته‌بندی‌ها
              </Link>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[48%] md:block" aria-hidden>
            <div className="absolute inset-8 flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-transparent shadow-[0_40px_80px_rgba(0,0,0,0.2)] backdrop-blur-sm animate-floaty">
              {heroImage ? (
                <div className="relative min-h-0 flex-1">
                  <img
                    src={mediaSrc(heroImage)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="relative min-h-0 flex-1 bg-transparent" />
              )}
              <div className="relative z-10 shrink-0 bg-transparent px-10 pb-10 pt-5">
                <div className="h-px w-full bg-gradient-to-l from-copper-400 to-transparent" />
                <p className="mt-4 font-display text-2xl font-bold text-white/90">{heroTitle}</p>
                <p className="mt-1 text-sm text-white/50">{heroSubtitle}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce-soft text-white/40" aria-hidden>
          <ChevronDown className="h-6 w-6" strokeWidth={1.5} />
        </div>
      </section>

      {/* Trust / benefits */}
      <section className="relative z-10 -mt-8 px-4">
        <Reveal className="reveal-scope mx-auto grid max-w-6xl gap-3 rounded-3xl border border-mist-200/80 bg-white/90 p-3 shadow-soft backdrop-blur sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:p-2">
          {BENEFITS.map((b, i) => (
            <div
              key={b.title}
              className="reveal flex gap-3 rounded-2xl px-4 py-5 transition hover:bg-mist-50"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-copper-400">
                {b.icon}
              </div>
              <div>
                <div className="font-semibold text-ink-900">{b.title}</div>
                <p className="mt-1 text-xs leading-6 text-ink-700/60">{b.text}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <Reveal className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest text-copper-600">FEATURED</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">محصولات ویژه</h2>
            <p className="mt-2 text-sm text-ink-700/60">منتخب‌هایی که این هفته بیشتر دیده شدند</p>
          </div>
          <Link to="/products" className="cursor-pointer text-sm font-semibold text-sea-600 transition hover:text-copper-600">
            همه محصولات ←
          </Link>
        </Reveal>
        {loading ? (
          <SkeletonGrid />
        ) : (
          <Reveal className="reveal-scope grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
            {!featured.length && (
              <p className="col-span-full text-sm text-ink-700/50">هنوز محصول ویژه‌ای ثبت نشده است.</p>
            )}
          </Reveal>
        )}
      </section>

      {/* Categories */}
      <section className="border-y border-mist-200 bg-ink-950 py-16 text-white md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest text-copper-400">CATEGORIES</p>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">دسته‌بندی‌ها</h2>
            <p className="mt-2 max-w-lg text-sm text-white/55">مسیر سریع به همان چیزی که دنبالش هستید</p>
          </Reveal>
          <Reveal className="reveal-scope mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c, i) => (
              <Link
                key={c.id}
                to={`/products?category=${c.id}`}
                className="reveal group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition duration-300 hover:-translate-y-1 hover:border-copper-400/40 hover:bg-white/10"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div className="aspect-[4/3] overflow-hidden bg-white/5">
                  {c.image ? (
                    <img
                      src={mediaSrc(c.image)}
                      alt={c.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-display text-4xl font-bold text-white/15">{c.name?.slice(0, 1)}</span>
                    </div>
                  )}
                </div>
                <div className="relative p-5">
                  <div className="font-display text-lg font-bold">{c.name}</div>
                  <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/50">
                    {c.description || 'مشاهده محصولات این دسته'}
                  </p>
                  <span className="mt-4 inline-flex text-xs font-semibold text-copper-400 transition group-hover:translate-x-[-4px]">
                    ورود به دسته ←
                  </span>
                </div>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <Reveal className="text-center">
          <p className="text-xs font-semibold tracking-widest text-copper-600">HOW IT WORKS</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">مسیر خرید ساده</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-700/60">در چهار قدم تا رسیدن گجت به دستتان</p>
        </Reveal>
        <Reveal className="reveal-scope mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="reveal relative rounded-2xl border border-mist-200 bg-white p-6 shadow-soft" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="font-display text-3xl font-extrabold text-copper-500/80">{s.n}</div>
              <div className="mt-3 font-semibold text-ink-900">{s.t}</div>
              <p className="mt-2 text-xs leading-6 text-ink-700/55">{s.d}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* CTA band */}
      <section className="px-4 pb-20">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-l from-ink-950 via-ink-900 to-sea-600 px-8 py-14 text-white md:px-14">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-copper-400/20 blur-3xl animate-orb" aria-hidden />
          <div className="relative max-w-xl">
            <h2 className="font-display text-3xl font-bold md:text-4xl">همین امروز گجتت را پیدا کن</h2>
            <p className="mt-3 text-sm leading-7 text-white/65">
              کاتالوگ به‌روز، قیمت شفاف و پرداخت امن — برای شروع کافی است یک محصول را انتخاب کنید.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="btn-primary cursor-pointer">شروع خرید</Link>
              <Link to="/contact" className="btn-ghost cursor-pointer">مشاوره بگیرید</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
