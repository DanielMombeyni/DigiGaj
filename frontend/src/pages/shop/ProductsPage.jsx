import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { shopApi } from '@/services/api'
import { ProductCard } from '@/components/shop/ProductCard'
import FilterSelect from '@/components/shop/FilterSelect'
import FilterActiveChips from '@/components/shop/FilterActiveChips'
import ProductsFilterPanel from '@/components/shop/ProductsFilterPanel'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { useDebounce } from '@/hooks/useDebounce'
import { faDigits } from '@/utils/format'
import { buildProductListParams, parseFeaturedParam } from '@/utils/productListQuery'

const SORT_OPTIONS = [
  { value: '', label: 'پیشنهادی فروشگاه' },
  { value: '-created_at', label: 'جدیدترین' },
  { value: 'price_toman', label: 'ارزان‌ترین' },
  { value: '-price_toman', label: 'گران‌ترین' },
]

const DEFAULT_CEIL = 20_000_000
const PRICE_STEP = 100_000

function roundUp(n, step = PRICE_STEP) {
  return Math.ceil(n / step) * step
}

function buildParams(args) {
  return buildProductListParams(args)
}

function parsePriceParam(value, fallback) {
  const n = Number(String(value || '').replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({ results: [], count: 0 })
  const [listError, setListError] = useState('')
  const [categories, setCategories] = useState([])
  const [priceBounds, setPriceBounds] = useState({ floor: 0, ceil: DEFAULT_CEIL })
  const [q, setQ] = useState(() => params.get('search') || '')
  const [category, setCategory] = useState(() => params.get('category') || '')
  const [priceRange, setPriceRange] = useState([0, DEFAULT_CEIL])
  const [ordering, setOrdering] = useState(() => params.get('ordering') || '')
  const [featured, setFeatured] = useState(() => parseFeaturedParam(params.get('is_featured')))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [boundsReady, setBoundsReady] = useState(false)
  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page') || 1) || 1))
  const fetchGen = useRef(0)

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
    if (!categories.length || !category) return
    const ok = categories.some((c) => String(c.id) === String(category))
    if (!ok) setCategory('')
  }, [categories, category])

  useEffect(() => {
    const fromUrl = buildParams({
      search: params.get('search') || '',
      category: params.get('category') || '',
      minPrice: params.get('min_price') || '',
      maxPrice: params.get('max_price') || '',
      ordering: params.get('ordering') || '',
      page: params.get('page') || '1',
      featured: parseFeaturedParam(params.get('is_featured')),
    }).toString()
    const fromState = buildParams({
      search: debouncedQ,
      category,
      minPrice: apiMin,
      maxPrice: apiMax,
      ordering,
      page,
      featured,
    }).toString()
    if (fromUrl === fromState) return
    setQ(params.get('search') || '')
    setCategory(params.get('category') || '')
    setPage(Math.max(1, Number(params.get('page') || 1) || 1))
    if (boundsReady) {
      setPriceRange([
        parsePriceParam(params.get('min_price'), priceBounds.floor),
        parsePriceParam(params.get('max_price'), priceBounds.ceil),
      ])
    }
    setOrdering(params.get('ordering') || '')
    setFeatured(parseFeaturedParam(params.get('is_featured')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, boundsReady])

  useEffect(() => {
    const next = buildParams({
      search: debouncedQ,
      category,
      minPrice: apiMin,
      maxPrice: apiMax,
      ordering,
      page,
      featured,
    })
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [debouncedQ, category, apiMin, apiMax, ordering, page, featured, params, setParams])

  const filterKey = `${debouncedQ}|${category}|${apiMin}|${apiMax}|${ordering}|${featured ? '1' : '0'}`
  const prevFilterKey = useRef(filterKey)
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return
    prevFilterKey.current = filterKey
    setPage(1)
  }, [filterKey])

  useEffect(() => {
    const gen = ++fetchGen.current
    let cancelled = false
    setLoading(true)
    setListError('')
    shopApi
      .products({
        search: debouncedQ || undefined,
        category: category || undefined,
        min_price: apiMin || undefined,
        max_price: apiMax || undefined,
        ordering: ordering || undefined,
        is_featured: featured ? true : undefined,
        page,
        page_size: 24,
      })
      .then((r) => {
        if (cancelled || gen !== fetchGen.current) return
        setData(r.data?.results ? r.data : { results: [], count: 0 })
      })
      .catch(() => {
        if (cancelled || gen !== fetchGen.current) return
        setData({ results: [], count: 0 })
        setListError('بارگذاری محصولات ناموفق بود. لطفاً دوباره تلاش کنید.')
      })
      .finally(() => {
        if (!cancelled && gen === fetchGen.current) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, category, apiMin, apiMax, ordering, featured, page])

  const list = data.results || data
  const items = Array.isArray(list) ? list : []
  const totalCount = typeof data.count === 'number' ? data.count : items.length
  const pageSize = 24
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)

  const priceFiltered =
    boundsReady &&
    (debouncedRange[0] > priceBounds.floor || debouncedRange[1] < priceBounds.ceil)

  const searchActive = Boolean(debouncedQ.trim())

  const clearFilters = () => {
    setQ('')
    setCategory('')
    setPriceRange([priceBounds.floor, priceBounds.ceil])
    setOrdering('')
    setFeatured(false)
    setPage(1)
    setListError('')
  }

  /** Any filter/sort/search that should show clear-all (includes search-only). */
  const hasClearableState = useMemo(
    () => Boolean(searchActive || category || priceFiltered || ordering || featured),
    [searchActive, category, priceFiltered, ordering, featured],
  )

  const panelFiltersActive = useMemo(
    () => Boolean(category || priceFiltered || featured),
    [category, priceFiltered, featured],
  )

  const activeChips = useMemo(() => {
    const chips = []
    if (searchActive) {
      chips.push({ key: 'search', label: `جستجو: ${debouncedQ.trim()}` })
    }
    if (category) {
      const cat = categories.find((c) => String(c.id) === category)
      chips.push({ key: 'category', label: cat?.name || 'دسته‌بندی' })
    }
    if (priceFiltered) {
      chips.push({
        key: 'price',
        label: `قیمت ${debouncedRange[0].toLocaleString('fa-IR')}–${debouncedRange[1].toLocaleString('fa-IR')}`,
      })
    }
    if (featured) {
      chips.push({ key: 'featured', label: 'محصولات ویژه' })
    }
    if (ordering) {
      const sortLabel = SORT_OPTIONS.find((o) => o.value === ordering)?.label
      if (sortLabel) chips.push({ key: 'ordering', label: sortLabel })
    }
    return chips
  }, [searchActive, debouncedQ, category, categories, priceFiltered, debouncedRange, featured, ordering])

  const removeChip = (key) => {
    if (key === 'search') setQ('')
    else if (key === 'category') setCategory('')
    else if (key === 'price') setPriceRange([priceBounds.floor, priceBounds.ceil])
    else if (key === 'featured') setFeatured(false)
    else if (key === 'ordering') setOrdering('')
  }

  const seoQuery = buildParams({
    search: debouncedQ,
    category,
    minPrice: apiMin,
    maxPrice: apiMax,
    ordering,
    page,
    featured,
  }).toString()

  const countLabel = loading
    ? 'در حال بارگذاری…'
    : listError
      ? null
      : totalCount === 0
        ? 'محصولی یافت نشد'
        : `${faDigits(totalCount)} محصول`

  return (
    <div className="mx-auto min-w-0 max-w-6xl px-4 py-10 md:py-14">
      <Seo
        title="محصولات"
        description={`کاتالوگ گجت‌ها و لوازم دیجیتال ${brand.name} — فیلتر دسته‌بندی، بازه قیمت و مرتب‌سازی`}
        path={`/products${seoQuery ? `?${seoQuery}` : ''}`}
      />
      <Reveal className="flex min-w-0 flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-copper-600">CATALOG</p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">محصولات</h1>
          <p className="mt-2 text-sm text-ink-700/60">گجت‌ها و لوازم دیجیتال با قیمت شفاف</p>
        </div>
        <label className="block min-w-0 w-full md:max-w-sm">
          <span className="sr-only">جستجوی محصول</span>
          <input
            className="input"
            placeholder="جستجو در نام و برند..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </Reveal>

      <Reveal className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex min-h-11 cursor-pointer items-center gap-2 px-4"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            فیلترها
            {panelFiltersActive && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-copper-500 px-1.5 text-[10px] font-bold text-white">
                {faDigits(
                  [category, priceFiltered, featured].filter(Boolean).length,
                )}
              </span>
            )}
          </button>
          {hasClearableState && (
            <button
              type="button"
              className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-sea-600 transition hover:bg-sea-50 hover:text-copper-600"
              onClick={clearFilters}
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
        <div className="w-full min-w-0 sm:max-w-[14rem]">
          <FilterSelect
            label="مرتب‌سازی"
            id="filter-sort"
            value={ordering}
            onChange={setOrdering}
            options={SORT_OPTIONS}
          />
        </div>
      </Reveal>

      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {countLabel && (
          <p className="text-sm font-medium tabular-nums text-ink-700/70" aria-live="polite">
            {countLabel}
          </p>
        )}
        <FilterActiveChips
          chips={activeChips}
          onRemove={removeChip}
          onClearAll={hasClearableState ? clearFilters : undefined}
          className="sm:justify-end"
        />
      </div>

      <ProductsFilterPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
        category={category}
        onCategoryChange={setCategory}
        priceBounds={priceBounds}
        priceRange={priceRange}
        onPriceChange={setPriceRange}
        boundsReady={boundsReady}
        featured={featured}
        onFeaturedChange={setFeatured}
        onClearAll={clearFilters}
        hasActiveFilters={panelFiltersActive || searchActive}
      />

      <div className="mt-8 min-w-0">
        {listError && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
            {listError}
          </p>
        )}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl bg-mist-100 sm:h-72 sm:aspect-auto"
              />
            ))}
          </div>
        ) : items.length ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="btn-secondary min-h-10 cursor-pointer px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  قبلی
                </button>
                <span className="rounded-xl bg-mist-100 px-3 py-2 text-xs font-semibold tabular-nums text-ink-700/70">
                  صفحه {faDigits(page)} از {faDigits(totalPages)}
                </span>
                <button
                  type="button"
                  className="btn-secondary min-h-10 cursor-pointer px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  بعدی
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-mist-200 bg-white px-6 py-16 text-center text-sm text-ink-700/50">
            {listError ? 'نتیجه‌ای نمایش داده نمی‌شود.' : 'محصولی با این فیلتر پیدا نشد.'}
          </p>
        )}
      </div>
    </div>
  )
}
