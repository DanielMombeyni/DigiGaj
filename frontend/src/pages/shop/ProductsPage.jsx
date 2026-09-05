import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
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

function buildParams({ search, category, minPrice, maxPrice, minRating, ordering }) {
  const next = new URLSearchParams()
  if (search) next.set('search', search)
  if (category) next.set('category', category)
  if (minPrice) next.set('min_price', minPrice)
  if (maxPrice) next.set('max_price', maxPrice)
  if (minRating) next.set('min_rating', minRating)
  if (ordering && ordering !== '-created_at') next.set('ordering', ordering)
  return next
}

function parsePriceParam(value, fallback) {
  const n = Number(String(value || '').replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function filtersDefaultOpen() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(min-width: 768px)').matches
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

  const debouncedQ = useDebounce(q, 300)
  const debouncedRange = useDebounce(priceRange, 400)

  const apiMin =
    boundsReady && debouncedRange[0] > priceBounds.floor ? String(debouncedRange[0]) : ''
  const apiMax =
    boundsReady && debouncedRange[1] < priceBounds.ceil ? String(debouncedRange[1]) : ''

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
    if (!boundsReady) return
    const fromUrl = buildParams({
      search: params.get('search') || '',
      category: params.get('category') || '',
      minPrice: params.get('min_price') || '',
      maxPrice: params.get('max_price') || '',
      minRating: params.get('min_rating') || '',
      ordering: params.get('ordering') || '-created_at',
    }).toString()
    const fromState = buildParams({
      search: debouncedQ,
      category,
      minPrice: apiMin,
      maxPrice: apiMax,
      minRating,
      ordering,
    }).toString()
    if (fromUrl === fromState) return
    setQ(params.get('search') || '')
    setCategory(params.get('category') || '')
    setMinRating(params.get('min_rating') || '')
    setPriceRange([
      parsePriceParam(params.get('min_price'), priceBounds.floor),
      parsePriceParam(params.get('max_price'), priceBounds.ceil),
    ])
    setOrdering(params.get('ordering') || '-created_at')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, boundsReady])

  useEffect(() => {
    if (!boundsReady) return
    const next = buildParams({
      search: debouncedQ,
      category,
      minPrice: apiMin,
      maxPrice: apiMax,
      minRating,
      ordering,
    })
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [debouncedQ, category, apiMin, apiMax, minRating, ordering, boundsReady, params, setParams])

  useEffect(() => {
    if (!boundsReady) return
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
  }, [debouncedQ, category, apiMin, apiMax, minRating, ordering, boundsReady])

  const list = data.results || data
  const items = Array.isArray(list) ? list : []

  const priceFiltered =
    boundsReady &&
    (debouncedRange[0] > priceBounds.floor || debouncedRange[1] < priceBounds.ceil)

  const clearFilters = () => {
    setQ('')
    setCategory('')
    setMinRating('')
    setPriceRange([priceBounds.floor, priceBounds.ceil])
    setOrdering('-created_at')
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

  const activeFilterLabels = useMemo(() => {
    const labels = []
    if (category) {
      const cat = categories.find((c) => String(c.id) === category)
      labels.push(cat?.name || 'دسته‌بندی')
    }
    if (minRating) labels.push(`${minRating} ستاره به بالا`)
    if (priceFiltered) {
      labels.push(`قیمت ${debouncedRange[0].toLocaleString('fa-IR')}–${debouncedRange[1].toLocaleString('fa-IR')}`)
    }
    const sortLabel = SORT_OPTIONS.find((o) => o.value === ordering)?.label
    if (ordering && ordering !== '-created_at' && sortLabel) labels.push(sortLabel)
    return labels
  }, [category, categories, minRating, priceFiltered, debouncedRange, ordering])

  const seoQuery = buildParams({
    search: debouncedQ,
    category,
    minPrice: apiMin,
    maxPrice: apiMax,
    minRating,
    ordering,
  }).toString()

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

      <Reveal className="mt-8 min-w-0 overflow-hidden rounded-2xl border border-mist-200/80 bg-white/80 shadow-soft">
        <div className="flex items-center gap-3 border-b border-mist-100 p-4">
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-start"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="products-filters-panel"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist-100 text-ink-700/70">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink-950">فیلترها</span>
              {!filtersOpen && activeFilterLabels.length > 0 && (
                <span className="mt-0.5 block truncate text-xs text-ink-700/55">
                  {activeFilterLabels.join(' · ')}
                </span>
              )}
              {!filtersOpen && !activeFilterLabels.length && (
                <span className="mt-0.5 block text-xs text-ink-700/45">دسته‌بندی، امتیاز، قیمت و مرتب‌سازی</span>
              )}
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-ink-700/45 transition-transform duration-300 ${
                filtersOpen ? 'rotate-180' : ''
              }`}
              strokeWidth={1.75}
            />
          </button>
          {panelFiltersActive && (
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-sea-600 transition hover:bg-sea-50 hover:text-copper-600"
              onClick={clearFilters}
            >
              پاک کردن
            </button>
          )}
        </div>

        <div
          id="products-filters-panel"
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="p-4 pt-3">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
              </div>

              <div className="mt-4 min-w-0 border-t border-mist-100 pt-4">
                <StarRatingFilter value={minRating} onChange={setMinRating} />
              </div>

              <div className="mt-4 min-w-0 border-t border-mist-100 pt-4">
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
          </div>
        </div>
      </Reveal>

      <div className="mt-10 min-w-0">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-mist-100" />
            ))}
          </div>
        ) : items.length ? (
          <Reveal className="reveal-scope grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </Reveal>
        ) : (
          <p className="rounded-2xl border border-dashed border-mist-200 bg-white px-6 py-16 text-center text-sm text-ink-700/50">
            محصولی با این فیلتر پیدا نشد.
          </p>
        )}
      </div>
    </div>
  )
}
