import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { shopApi } from '@/services/api'
import { ProductCard } from '@/components/shop/ProductCard'
import FilterSelect from '@/components/shop/FilterSelect'
import PriceRangeSlider from '@/components/shop/PriceRangeSlider'
import StarRatingFilter from '@/components/shop/StarRatingFilter'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { useDebounce } from '@/hooks/useDebounce'
import { categorySelectOptions } from '@/utils/categories'
import { cn, faDigits } from '@/utils/format'

const SORT_OPTIONS = [
  { value: '-created_at', label: 'جدیدترین' },
  { value: 'price_toman', label: 'ارزان‌ترین' },
  { value: '-price_toman', label: 'گران‌ترین' },
]

const DEFAULT_CEIL = 20_000_000
const PRICE_STEP = 100_000

function roundUp(n, step = PRICE_STEP) {
  return Math.ceil(n / step) * step
}

function buildParams({ search, category, minPrice, maxPrice, minRating, ordering, page }) {
  const next = new URLSearchParams()
  if (search) next.set('search', search)
  if (category) next.set('category', category)
  if (minPrice) next.set('min_price', minPrice)
  if (maxPrice) next.set('max_price', maxPrice)
  if (minRating) next.set('min_rating', minRating)
  if (ordering && ordering !== '-created_at') next.set('ordering', ordering)
  if (page && Number(page) > 1) next.set('page', String(page))
  return next
}

function parsePriceParam(value, fallback) {
  const n = Number(String(value || '').replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function filtersDefaultOpen() {
  return false
}

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-mist-100" />
      ))}
    </div>
  )
}

function FilterFields({
  categories,
  category,
  setCategory,
  ordering,
  setOrdering,
  minRating,
  setMinRating,
  boundsReady,
  priceBounds,
  priceRange,
  setPriceRange,
}) {
  return (
    <div className="space-y-6">
      <FilterSelect
        label="دسته‌بندی"
        id="filter-category"
        value={category}
        onChange={setCategory}
        options={categorySelectOptions(categories, { includeRootLabel: true })}
      />

      <FilterSelect
        label="مرتب‌سازی"
        id="filter-sort"
        value={ordering}
        onChange={setOrdering}
        options={SORT_OPTIONS}
      />

      <div>
        <StarRatingFilter value={minRating} onChange={setMinRating} />
      </div>

      <div>
        <span className="label">بازه قیمت (تومان)</span>
        {boundsReady ? (
          <PriceRangeSlider
            min={priceBounds.floor}
            max={priceBounds.ceil}
            valueMin={priceRange[0]}
            valueMax={priceRange[1]}
            step={PRICE_STEP}
            onChange={setPriceRange}
          />
        ) : (
          <div className="mt-2 h-9 animate-pulse rounded-xl bg-mist-100" />
        )}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({ results: [] })
  const [categories, setCategories] = useState([])
  const [priceBounds, setPriceBounds] = useState({ floor: 0, ceil: DEFAULT_CEIL })
  const [q, setQ] = useState(() => params.get('search') || '')
  const [category, setCategory] = useState(() => params.get('category') || '')
  const [priceRange, setPriceRange] = useState([0, DEFAULT_CEIL])
  const [ordering, setOrdering] = useState(() => params.get('ordering') || '-created_at')
  const [minRating, setMinRating] = useState(() => params.get('min_rating') || '')
  const [filtersOpen, setFiltersOpen] = useState(filtersDefaultOpen)
  const [loading, setLoading] = useState(true)
  const [boundsReady, setBoundsReady] = useState(false)
  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page') || 1) || 1))

  const debouncedQ = useDebounce(q, 300)
  const debouncedRange = useDebounce(priceRange, 400)

  const urlMin = params.get('min_price') || ''
  const urlMax = params.get('max_price') || ''
  const apiMin = boundsReady
    ? debouncedRange[0] > priceBounds.floor
      ? String(debouncedRange[0])
      : ''
    : urlMin
  const apiMax = boundsReady
    ? debouncedRange[1] < priceBounds.ceil
      ? String(debouncedRange[1])
      : ''
    : urlMax

  const paramKey = params.toString()

  useEffect(() => {
    let cancelled = false
    Promise.all([shopApi.categories({ page_size: 100 }), shopApi.productPriceStats()])
      .then(([catRes, statsRes]) => {
        if (cancelled) return
        const list = catRes.data.results || catRes.data
        setCategories(Array.isArray(list) ? list.filter((c) => c.is_active !== false) : [])

        const floor = 0
        const rawCeil = statsRes.data?.max_price || DEFAULT_CEIL
        const ceil = Math.max(roundUp(rawCeil), PRICE_STEP)

        setPriceBounds({ floor, ceil })
        setPriceRange([
          parsePriceParam(params.get('min_price'), floor),
          parsePriceParam(params.get('max_price'), ceil),
        ])
        setBoundsReady(true)
      })
      .catch(() => {
        if (!cancelled) setBoundsReady(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const fromUrl = buildParams({
      search: params.get('search') || '',
      category: params.get('category') || '',
      minPrice: params.get('min_price') || '',
      maxPrice: params.get('max_price') || '',
      minRating: params.get('min_rating') || '',
      ordering: params.get('ordering') || '-created_at',
      page: params.get('page') || '1',
    }).toString()
    const fromState = buildParams({
      search: debouncedQ,
      category,
      minPrice: apiMin,
      maxPrice: apiMax,
      minRating,
      ordering,
      page,
    }).toString()
    if (fromUrl === fromState) return
    setQ(params.get('search') || '')
    setCategory(params.get('category') || '')
    setMinRating(params.get('min_rating') || '')
    setPage(Math.max(1, Number(params.get('page') || 1) || 1))
    if (boundsReady) {
      setPriceRange([
        parsePriceParam(params.get('min_price'), priceBounds.floor),
        parsePriceParam(params.get('max_price'), priceBounds.ceil),
      ])
    }
    setOrdering(params.get('ordering') || '-created_at')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, boundsReady])

  useEffect(() => {
    const next = buildParams({
      search: debouncedQ,
      category,
      minPrice: apiMin,
      maxPrice: apiMax,
      minRating,
      ordering,
      page,
    })
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [debouncedQ, category, apiMin, apiMax, minRating, ordering, page, params, setParams])

  const filterKey = `${debouncedQ}|${category}|${apiMin}|${apiMax}|${minRating}|${ordering}`
  const prevFilterKey = useRef(filterKey)
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return
    prevFilterKey.current = filterKey
    setPage(1)
  }, [filterKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    shopApi
      .products({
        search: debouncedQ || undefined,
        category: category || undefined,
        min_price: apiMin || undefined,
        max_price: apiMax || undefined,
        min_rating: minRating || undefined,
        ordering: ordering || undefined,
        page,
        page_size: 24,
      })
      .then((r) => {
        if (!cancelled) setData(r.data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, category, apiMin, apiMax, minRating, ordering, page])

  const list = data.results || data
  const items = Array.isArray(list) ? list : []
  const totalCount = typeof data.count === 'number' ? data.count : items.length
  const pageSize = 24
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)

  const priceFiltered =
    boundsReady &&
    (debouncedRange[0] > priceBounds.floor || debouncedRange[1] < priceBounds.ceil)

  const clearFilters = () => {
    setQ('')
    setCategory('')
    setMinRating('')
    setPriceRange([priceBounds.floor, priceBounds.ceil])
    setOrdering('-created_at')
    setPage(1)
  }

  const panelFiltersActive = useMemo(
    () =>
      Boolean(
        category ||
          priceFiltered ||
          minRating ||
          (ordering && ordering !== '-created_at'),
      ),
    [category, priceFiltered, minRating, ordering],
  )

  const anyFilterActive = Boolean(debouncedQ || panelFiltersActive)

  const activeFilterLabels = useMemo(() => {
    const labels = []
    if (category) {
      const cat = categories.find((c) => String(c.id) === category)
      labels.push(cat?.name || 'دسته‌بندی')
    }
    if (minRating) labels.push(`${faDigits(minRating)} ستاره به بالا`)
    if (priceFiltered) {
      labels.push(
        `قیمت ${debouncedRange[0].toLocaleString('fa-IR')} تا ${debouncedRange[1].toLocaleString('fa-IR')}`,
      )
    }
    const sortLabel = SORT_OPTIONS.find((o) => o.value === ordering)?.label
    if (ordering && ordering !== '-created_at' && sortLabel) labels.push(sortLabel)
    return labels
  }, [category, categories, minRating, priceFiltered, debouncedRange, ordering])

  const activeCategoryName = useMemo(() => {
    if (!category) return null
    return categories.find((c) => String(c.id) === category)?.name || null
  }, [category, categories])

  const seoQuery = buildParams({
    search: debouncedQ,
    category,
    minPrice: apiMin,
    maxPrice: apiMax,
    minRating,
    ordering,
    page,
  }).toString()

  const filterProps = {
    categories,
    category,
    setCategory,
    ordering,
    setOrdering,
    minRating,
    setMinRating,
    boundsReady,
    priceBounds,
    priceRange,
    setPriceRange,
  }

  return (
    <div className="min-w-0 overflow-x-clip">
      <Seo
        title="محصولات"
        description={`کاتالوگ گجت‌ها و لوازم دیجیتال ${brand.name}. فیلتر دسته‌بندی، بازه قیمت و مرتب‌سازی`}
        path={`/products${seoQuery ? `?${seoQuery}` : ''}`}
      />

      {/* Full-bleed hero: brand first, search as primary action */}
      <section className="relative overflow-hidden bg-hero-mesh text-white">
        <div className="hero-noise absolute inset-0 opacity-[0.28]" aria-hidden />
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -start-16 top-10 h-52 w-52 rounded-full bg-sea-500/20 blur-3xl animate-orb-slow" />
          <div className="absolute -end-10 bottom-0 h-56 w-56 rounded-full bg-copper-400/18 blur-3xl animate-orb" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-16 sm:pb-14 sm:pt-20 lg:pb-16 lg:pt-20">
          <Reveal className="min-w-0 max-w-2xl">
            <p className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              {brand.name}
            </p>
            <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-white/90 sm:text-3xl md:text-4xl">
              {activeCategoryName || 'محصولات'}
            </h1>
            <p className="mt-3 max-w-[32ch] text-sm leading-7 text-white/55 sm:max-w-md sm:text-base sm:leading-8">
              {debouncedQ
                ? `نتایج جست‌وجو برای «${debouncedQ}»`
                : 'گجت‌ها و لوازم دیجیتال با قیمت شفاف و فیلتر دقیق.'}
            </p>

            <form
              className="mt-7"
              onSubmit={(e) => {
                e.preventDefault()
              }}
            >
              <label className="block min-w-0 max-w-lg">
                <span className="sr-only">جستجوی محصول</span>
                <div className="flex overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-md focus-within:border-copper-400/50">
                  <input
                    type="search"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/40"
                    placeholder="جستجو در نام و برند..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <span className="flex items-center px-4 text-white/45" aria-hidden>
                    <Search className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                </div>
              </label>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/categories"
                className="btn-ghost min-h-11 cursor-pointer px-5 active:scale-[0.98]"
              >
                دسته‌بندی‌ها
              </Link>
              {!loading ? (
                <p className="text-xs text-white/40">
                  <span className="tabular-nums text-white/70">{faDigits(totalCount)}</span>
                  {' '}
                  محصول
                </p>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl min-w-0 px-4 py-10 sm:py-12 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
          {/* Desktop sticky filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-6 border-s border-mist-200 ps-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink-900">فیلترها</h2>
                {panelFiltersActive ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cursor-pointer text-xs font-medium text-sea-600 transition hover:text-copper-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
                  >
                    پاک کردن
                  </button>
                ) : null}
              </div>
              <FilterFields {...filterProps} />
            </div>
          </aside>

          <div className="min-w-0">
            {/* Mobile filters */}
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-2 border-b border-mist-200 pb-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  aria-controls="products-filters-panel"
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-ink-700/55" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">فیلترها</span>
                    {!filtersOpen && activeFilterLabels.length > 0 ? (
                      <span className="mt-0.5 block truncate text-xs text-ink-700/50">
                        {activeFilterLabels.join(' / ')}
                      </span>
                    ) : null}
                    {!filtersOpen && !activeFilterLabels.length ? (
                      <span className="mt-0.5 block text-xs text-ink-700/40">
                        دسته، امتیاز، قیمت و مرتب‌سازی
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 shrink-0 text-ink-700/40 transition-transform duration-300',
                      filtersOpen && 'rotate-180',
                    )}
                    strokeWidth={1.75}
                  />
                </button>
                {panelFiltersActive ? (
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium text-sea-600 transition hover:bg-mist-100 hover:text-copper-600"
                    onClick={clearFilters}
                  >
                    پاک کردن
                  </button>
                ) : null}
              </div>

              <div
                id="products-filters-panel"
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-out',
                  filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="pt-5">
                    <FilterFields {...filterProps} />
                  </div>
                </div>
              </div>
            </div>

            {/* Results meta */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-700/55">
                {loading ? (
                  'در حال بارگذاری...'
                ) : (
                  <>
                    <span className="font-semibold tabular-nums text-ink-900">
                      {faDigits(totalCount)}
                    </span>
                    {' '}
                    محصول
                    {activeCategoryName ? (
                      <>
                        {' '}
                        در
                        {' '}
                        <span className="font-semibold text-ink-800">{activeCategoryName}</span>
                      </>
                    ) : null}
                  </>
                )}
              </p>
              {anyFilterActive && !loading ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-700/50 transition hover:text-copper-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 lg:hidden"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  حذف فیلترها
                </button>
              ) : null}
            </div>

            {loading ? (
              <ProductsSkeleton />
            ) : items.length ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  {items.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-12 flex flex-wrap items-center justify-center gap-2 border-t border-mist-200 pt-8">
                    <button
                      type="button"
                      className="btn-secondary min-h-10 cursor-pointer px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      قبلی
                    </button>
                    <span className="px-3 py-2 text-xs font-semibold tabular-nums text-ink-700/60">
                      صفحه {faDigits(page)} از {faDigits(totalPages)}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary min-h-10 cursor-pointer px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      بعدی
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="px-1 py-16 text-center">
                <p className="text-sm text-ink-700/55">محصولی با این فیلتر پیدا نشد.</p>
                {anyFilterActive ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn-primary mt-6 inline-flex min-h-11 cursor-pointer active:scale-[0.98]"
                  >
                    پاک کردن فیلترها
                  </button>
                ) : (
                  <Link
                    to="/categories"
                    className="btn-primary mt-6 inline-flex min-h-11 cursor-pointer active:scale-[0.98]"
                  >
                    مشاهده دسته‌ها
                  </Link>
                )}
              </div>
            )}

            <Reveal className="mt-16 border-t border-mist-200 pt-10 sm:mt-20 sm:pt-12">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 max-w-md">
                  <h2 className="font-display text-xl font-bold text-ink-900 sm:text-2xl">
                    بازگشت به فروشگاه
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-ink-700/55">
                    پیشنهادهای ویژه و معرفی فروشگاه را در صفحه اصلی ببینید.
                  </p>
                </div>
                <Link
                  to="/"
                  className="btn-dark inline-flex min-h-11 w-fit shrink-0 cursor-pointer px-6 active:scale-[0.98]"
                >
                  صفحه اصلی
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  )
}
