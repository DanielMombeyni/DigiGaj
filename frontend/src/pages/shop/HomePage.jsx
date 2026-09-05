import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Truck,
  CreditCard,
  ShieldCheck,
  CircleHelp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
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

function CategoryRail({ categories, loading }) {
  const scrollerRef = useRef(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateEdges = () => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // With dir=ltr: scrollLeft 0 = start (left), max = end (right)
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < max - 4)
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined
    updateEdges()
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('scroll', updateEdges, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null
    ro?.observe(el)
    window.addEventListener('resize', updateEdges)
    return () => {
      el.removeEventListener('scroll', updateEdges)
      el.removeEventListener('wheel', onWheel)
      ro?.disconnect()
      window.removeEventListener('resize', updateEdges)
    }
  }, [categories, loading])

  const scrollByDir = (dir) => {
    const el = scrollerRef.current
    if (!el) return
    const amount = Math.min(280, el.clientWidth * 0.7) * dir
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="mt-8 flex gap-4 overflow-hidden px-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex w-[4.75rem] shrink-0 flex-col items-center gap-2.5">
            <div className="h-[4.75rem] w-[4.75rem] animate-pulse rounded-full bg-white/10" />
            <div className="h-2.5 w-12 animate-pulse rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    )
  }

  if (!categories.length) {
    return <p className="mt-8 text-sm text-white/45">هنوز دسته‌بندی‌ای ثبت نشده است.</p>
  }

  return (
    <div className="relative mt-8">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-ink-950 to-transparent md:w-14"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-ink-950 to-transparent md:w-14"
        aria-hidden
      />

      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        disabled={!canPrev}
        aria-label="دسته‌های قبلی"
        className="absolute left-0 top-[1.85rem] z-[2] hidden h-9 w-9 -translate-x-1 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-ink-900/90 text-white shadow-lg backdrop-blur-sm transition hover:border-copper-400/50 hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-0 md:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        disabled={!canNext}
        aria-label="دسته‌های بعدی"
        className="absolute right-0 top-[1.85rem] z-[2] hidden h-9 w-9 translate-x-1 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-ink-900/90 text-white shadow-lg backdrop-blur-sm transition hover:border-copper-400/50 hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-0 md:inline-flex"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>

      <div
        ref={scrollerRef}
        dir="ltr"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-2 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] md:gap-5 md:px-8 [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/products?category=${c.id}`}
            className="group flex w-[4.75rem] shrink-0 snap-start flex-col items-center gap-2.5 text-center focus-visible:outline-none md:w-[5.25rem]"
          >
            <span className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center md:h-[5.25rem] md:w-[5.25rem]">
              <span
                className="absolute inset-0 rounded-full bg-gradient-to-br from-copper-400/35 via-white/5 to-sea-600/30 opacity-70 transition duration-300 group-hover:opacity-100 group-hover:shadow-[0_0_24px_rgba(232,168,124,0.25)]"
                aria-hidden
              />
              <span className="relative h-[calc(100%-6px)] w-[calc(100%-6px)] overflow-hidden rounded-full border border-white/15 bg-ink-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 group-hover:border-copper-400/45 group-focus-visible:ring-2 group-focus-visible:ring-copper-400 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-ink-950">
                {c.image ? (
                  <img
                    src={mediaSrc(c.image)}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.03]">
                    <span className="font-display text-xl font-bold text-white/35 md:text-2xl">
                      {c.name?.slice(0, 1)}
                    </span>
                  </span>
                )}
              </span>
            </span>
            <span className="line-clamp-2 min-h-[2.25rem] px-0.5 text-[11px] font-semibold leading-tight text-white/75 transition group-hover:text-white md:text-xs">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
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
                    loading="eager"
                    fetchPriority="high"
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
      <section className="relative overflow-hidden border-y border-mist-200 bg-ink-950 py-12 text-white md:py-16">
        <div
          className="pointer-events-none absolute -left-24 top-0 h-56 w-56 rounded-full bg-copper-400/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-sea-600/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4">
          <Reveal className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-copper-400">CATEGORIES</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
                دسته‌بندی‌ها
              </h2>
              <p className="mt-1 text-sm text-white/50">اسکرول افقی کنید و دسته مورد نظر را انتخاب کنید</p>
            </div>
            <Link
              to="/categories"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-copper-400 transition hover:border-copper-400/40 hover:bg-white/10 hover:text-copper-300"
            >
              همه دسته‌ها
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </Reveal>

          <CategoryRail categories={categories} loading={loading} />
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
