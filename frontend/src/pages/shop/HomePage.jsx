import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Truck,
  CreditCard,
  ShieldCheck,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpLeft,
} from 'lucide-react'
import { shopApi } from '@/services/api'
import { ProductCard } from '@/components/shop/ProductCard'
import Seo, { organizationJsonLd } from '@/components/common/Seo'
import BrandLogo from '@/components/common/BrandLogo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { mediaSrc } from '@/utils/media'
import { useDebounce } from '@/hooks/useDebounce'
import { cn, faDigits, toman } from '@/utils/format'
import { isPriceOnRequest } from '@/utils/pricing'

const BENEFITS = [
  {
    title: 'ارسال سریع',
    text: 'ارسال به سراسر کشور با بسته‌بندی ایمن مخصوص گجت',
    icon: Truck,
  },
  {
    title: 'پرداخت امن',
    text: 'درگاه‌های معتبر و امکان کارت‌به‌کارت با تأیید ادمین',
    icon: CreditCard,
  },
  {
    title: 'گارانتی معتبر',
    text: 'محصولات با ضمانت اصالت و پشتیبانی واقعی',
    icon: ShieldCheck,
  },
  {
    title: 'مشاوره تخصصی',
    text: 'کمک برای انتخاب درست قبل از خرید',
    icon: CircleHelp,
  },
]

const STEPS = [
  { t: 'انتخاب گجت', d: 'از میان دسته‌بندی‌ها و محصولات ویژه' },
  { t: 'ثبت سفارش', d: 'آدرس و کد تخفیف را وارد کنید' },
  { t: 'پرداخت امن', d: 'درگاه آنلاین یا کارت‌به‌کارت' },
  { t: 'دریافت سریع', d: 'پیگیری سفارش تا لحظه تحویل' },
]

function HomeSearchBar() {
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const debouncedQ = useDebounce(q, 300)

  useEffect(() => {
    const term = debouncedQ.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    shopApi
      .products({ search: term, page_size: 6 })
      .then((r) => {
        if (cancelled) return
        const list = r.data?.results || r.data || []
        setResults(Array.isArray(list) ? list : [])
        setOpen(true)
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ])

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const goSearch = (e) => {
    e?.preventDefault?.()
    const term = q.trim()
    if (!term) return
    setOpen(false)
    navigate(`/products?search=${encodeURIComponent(term)}`)
  }

  const goProduct = (slug) => {
    setOpen(false)
    navigate(`/products/${slug}`)
  }

  const showPanel = open && q.trim().length >= 2

  return (
    <form ref={wrapRef} onSubmit={goSearch} className="relative mt-7 max-w-lg">
      <div className="flex overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-md focus-within:border-copper-400/50">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => q.trim().length >= 2 && setOpen(true)}
          placeholder="جستجوی محصول، برند یا مدل..."
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/40"
          autoComplete="off"
          aria-label="جستجوی محصول"
          aria-expanded={showPanel}
          aria-controls="home-search-results"
        />
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center gap-2 bg-copper-500 px-4 text-sm font-semibold text-white transition hover:bg-copper-600 active:scale-[0.98] sm:px-5"
        >
          <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
          <span className="hidden sm:inline">جستجو</span>
        </button>
      </div>

      {showPanel ? (
        <div
          id="home-search-results"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-mist-200 bg-white text-ink-900 shadow-[0_20px_50px_rgba(15,23,42,0.28)]"
        >
          {loading ? (
            <p className="px-4 py-3 text-sm text-ink-700/50">در حال جستجو...</p>
          ) : results.length ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((p) => {
                const onRequest = isPriceOnRequest(p)
                const price = p.min_price ?? p.price_toman
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => goProduct(p.slug)}
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start transition hover:bg-mist-50"
                    >
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-mist-100">
                        {p.primary_image ? (
                          <img
                            src={mediaSrc(p.primary_image)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs font-bold text-ink-700/30">
                            {p.name?.slice(0, 1)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{p.name}</span>
                        <span className="mt-0.5 block text-xs text-copper-600">
                          {onRequest ? 'قیمت با تماس' : toman(price)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-700/50">
              محصولی پیدا نشد. جستجو را بزنید تا در کاتالوگ ببینید.
            </p>
          )}
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-t border-mist-100 bg-mist-50/80 px-4 py-2.5 text-xs font-semibold text-sea-600 transition hover:bg-mist-100 hover:text-copper-600"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            جستجو برای «{q.trim()}» در همه محصولات
          </button>
        </div>
      ) : null}
    </form>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-mist-100" />
      ))}
    </div>
  )
}

function CategoryMedia({ category }) {
  if (category.image) {
    return (
      <img
        src={mediaSrc(category.image)}
        alt=""
        className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        loading="lazy"
        draggable={false}
      />
    )
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-sea-600/35"
      aria-hidden
    >
      <span className="font-display text-3xl font-bold text-white/15 sm:text-4xl">
        {category.name?.slice(0, 1)}
      </span>
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
    const amount = Math.min(320, el.clientWidth * 0.7) * dir
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="mt-8 flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 w-40 shrink-0 animate-pulse rounded-2xl bg-white/10 sm:h-40 sm:w-44" />
        ))}
      </div>
    )
  }

  if (!categories.length) {
    return <p className="mt-8 text-sm text-white/45">هنوز دسته‌بندی‌ای ثبت نشده است.</p>
  }

  return (
    <div className="relative mt-8">
      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        disabled={!canPrev}
        aria-label="دسته‌های قبلی"
        className="absolute start-0 top-1/2 z-[2] hidden h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-ink-900/90 text-white shadow-lg backdrop-blur-sm transition hover:border-copper-400/50 hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-0 md:inline-flex"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        disabled={!canNext}
        aria-label="دسته‌های بعدی"
        className="absolute end-0 top-1/2 z-[2] hidden h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-ink-900/90 text-white shadow-lg backdrop-blur-sm transition hover:border-copper-400/50 hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-0 md:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>

      <div
        ref={scrollerRef}
        dir="ltr"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] md:gap-4 md:px-10 [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/products?category=${c.id}`}
            className="group flex w-[9.5rem] shrink-0 snap-start flex-col outline-none focus-visible:ring-2 focus-visible:ring-copper-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 sm:w-[11rem]"
          >
            <span className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-ink-900">
              <CategoryMedia category={c} />
              <span
                className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent opacity-80"
                aria-hidden
              />
            </span>
            <span className="mt-2.5 flex items-center justify-between gap-2 px-0.5">
              <span className="min-w-0 truncate text-sm font-semibold text-white/80 transition group-hover:text-white">
                {c.name}
              </span>
              <ArrowUpLeft
                className="h-3.5 w-3.5 shrink-0 text-white/30 transition group-hover:text-copper-400"
                strokeWidth={2}
                aria-hidden
              />
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
  const tagline = settings.tagline || 'تکنولوژی روز، انتخاب مطمئن'

  return (
    <div className="min-w-0 overflow-x-clip">
      <Seo
        title="خانه"
        description={
          settings.tagline ||
          'خرید و فروش تخصصی گجت‌های روز. هدفون، ساعت هوشمند، لوازم موبایل و گیمینگ'
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

      {/* Hero: brand first, one composition, search + CTAs */}
      <section className="relative overflow-hidden bg-hero-mesh text-white">
        <div className="hero-noise absolute inset-0 opacity-[0.28]" aria-hidden />
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -start-16 top-10 h-52 w-52 rounded-full bg-sea-500/20 blur-3xl animate-orb-slow" />
          <div className="absolute -end-10 bottom-0 h-56 w-56 rounded-full bg-copper-400/18 blur-3xl animate-orb" />
        </div>

        <div className="relative mx-auto grid min-h-[min(88dvh,42rem)] max-w-6xl items-end gap-10 px-4 pb-14 pt-20 sm:pb-16 sm:pt-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-14 lg:pb-20 lg:pt-24">
          <Reveal className="min-w-0">
            <BrandLogo size="hero" className="block" restClass="text-white" />
            <h1 className="mt-5 font-display text-2xl font-bold leading-tight text-white/90 sm:text-3xl md:text-4xl">
              {tagline}
            </h1>
            <p className="mt-3 max-w-[34ch] text-sm leading-7 text-white/55 sm:max-w-md sm:text-base sm:leading-8">
              از هدفون و ساعت هوشمند تا لوازم گیمینگ. خرید امن، ارسال سریع، پشتیبانی واقعی.
            </p>
            <HomeSearchBar />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/products"
                className="btn-primary min-h-11 cursor-pointer px-7 active:scale-[0.98]"
              >
                مشاهده محصولات
              </Link>
              <Link to="/categories" className="btn-ghost min-h-11 cursor-pointer active:scale-[0.98]">
                دسته‌بندی‌ها
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80} className="relative hidden min-h-[16rem] lg:block">
            <div className="absolute inset-y-4 start-8 end-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/40">
              {heroImage ? (
                <img
                  src={mediaSrc(heroImage)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              ) : categories[0] ? (
                <CategoryMedia category={categories[0]} />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-ink-900 to-sea-600/30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-l from-ink-950/10 via-transparent to-ink-950/70" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="font-display text-xl font-bold text-white/90">{heroTitle}</p>
                <p className="mt-1 text-sm text-white/45">{heroSubtitle}</p>
              </div>
            </div>
            <div className="absolute -start-2 bottom-0 top-14 w-[52%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              {categories[1] ? (
                <CategoryMedia category={categories[1]} />
              ) : featured[0]?.primary_image ? (
                <img
                  src={mediaSrc(featured[0].primary_image)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-copper-600/40 to-ink-900" />
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Benefits: strip without card chrome */}
      <section className="border-b border-mist-200 bg-white/70">
        <Reveal className="mx-auto grid max-w-6xl gap-0 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon
            return (
              <div
                key={b.title}
                className={cn(
                  'flex gap-3 px-4 py-7 sm:px-5',
                  i > 0 && 'border-t border-mist-200 sm:border-t-0',
                  i % 2 === 1 && 'sm:border-s sm:border-mist-200',
                  i >= 2 && 'lg:border-s lg:border-mist-200',
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-copper-400">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{b.title}</p>
                  <p className="mt-1 text-xs leading-6 text-ink-700/55">{b.text}</p>
                </div>
              </div>
            )
          })}
        </Reveal>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <Reveal className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-lg">
            <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl md:text-4xl">
              محصولات ویژه
            </h2>
            <p className="mt-2 text-sm leading-7 text-ink-700/55">
              منتخب‌هایی که این هفته بیشتر دیده شدند.
            </p>
          </div>
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 transition hover:text-copper-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
          >
            مشاهده محصولات
            <ArrowUpLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        </Reveal>
        {loading ? (
          <SkeletonGrid />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            {!featured.length ? (
              <p className="col-span-full py-10 text-center text-sm text-ink-700/50">
                هنوز محصول ویژه‌ای ثبت نشده است.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="relative overflow-hidden bg-ink-950 py-12 text-white md:py-16">
        <div
          className="pointer-events-none absolute -start-24 top-0 h-56 w-56 rounded-full bg-copper-400/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -end-16 bottom-0 h-48 w-48 rounded-full bg-sea-600/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4">
          <Reveal className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 max-w-lg">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                دسته‌بندی‌ها
              </h2>
              <p className="mt-2 text-sm text-white/50">دسته مورد نظرتان را انتخاب کنید.</p>
            </div>
            <Link
              to="/categories"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-copper-400 transition hover:text-copper-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
            >
              همه دسته‌ها
              <ArrowUpLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Link>
          </Reveal>
          <CategoryRail categories={categories} loading={loading} />
        </div>
      </section>

      {/* Steps: timeline, not four equal cards */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <Reveal className="max-w-lg">
          <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl md:text-4xl">
            مسیر خرید ساده
          </h2>
          <p className="mt-2 text-sm leading-7 text-ink-700/55">
            از انتخاب تا تحویل، در چهار قدم.
          </p>
        </Reveal>
        <Reveal className="mt-10 border-s border-mist-200">
          <ol className="space-y-0">
            {STEPS.map((s, i) => (
              <li
                key={s.t}
                className="relative grid gap-2 border-b border-mist-200 py-5 ps-6 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-baseline sm:gap-8 sm:py-6 sm:ps-8"
              >
                <span className="font-display text-lg font-bold tabular-nums text-copper-500/90">
                  {faDigits(String(i + 1).padStart(2, '0'))}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{s.t}</p>
                  <p className="mt-1 text-sm leading-7 text-ink-700/55">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Closing band */}
      <section className="border-t border-mist-200 px-4 py-14 md:py-16">
        <Reveal className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-md">
            <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">
              نیاز به راهنمایی دارید؟
            </h2>
            <p className="mt-2 text-sm leading-7 text-ink-700/55">
              برای انتخاب گجت مناسب، با ما در تماس باشید.
            </p>
          </div>
          <Link
            to="/contact"
            className="btn-dark inline-flex min-h-11 w-fit shrink-0 cursor-pointer px-6 active:scale-[0.98]"
          >
            مشاوره بگیرید
          </Link>
        </Reveal>
      </section>
    </div>
  )
}
