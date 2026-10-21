import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { shopApi } from '@/services/api'
import { ProductCard } from '@/components/shop/ProductCard'
import FilterSelect from '@/components/shop/FilterSelect'
import FilterActiveChips from '@/components/shop/FilterActiveChips'
import ProductsFilterPanel from '@/components/shop/ProductsFilterPanel'
import CategoryFilterTree from '@/components/shop/CategoryFilterTree'
import PriceRangeSlider from '@/components/shop/PriceRangeSlider'
import {
  BrandSection,
  CollapsibleSection,
  ColorSection,
  StockSection,
} from '@/components/shop/FilterFacetSections'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { useDebounce } from '@/hooks/useDebounce'
import { cn, faDigits, toman } from '@/utils/format'
import { categoryChildrenMap } from '@/utils/categories'
import {
  buildProductListParams,
  parseFeaturedParam,
  parseInStockParam,
  parseListParam,
} from '@/utils/productListQuery'

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

function roundDown(n, step = PRICE_STEP) {
  return Math.floor(n / step) * step
}

function buildParams(args) {
  return buildProductListParams(args)
}

function parsePriceParam(value, fallback) {
  const n = Number(String(value || '').replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function clampPrice(n, floor, ceil) {
  if (!Number.isFinite(n)) return floor
  return Math.min(ceil, Math.max(floor, n))
}

/** Build slider bounds from API min/max (toman). */
function boundsFromStats(rawMin, rawMax) {
  const minN = Number(rawMin)
  const maxN = Number(rawMax)
  if (!Number.isFinite(minN) || !Number.isFinite(maxN) || minN <= 0 || maxN <= 0) {
    return { floor: 0, ceil: 0, mode: 'none' }
  }
  if (minN === maxN) {
    return { floor: minN, ceil: maxN, mode: 'single' }
  }
  let floor = roundDown(minN)
  let ceil = roundUp(maxN)
  if (ceil <= floor) {
    return { floor: minN, ceil: maxN, mode: 'single' }
  }
  if (ceil - floor < PRICE_STEP) {
    return { floor: minN, ceil: maxN, mode: 'single' }
  }
  return { floor, ceil, mode: 'range' }
}

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({ results: [], count: 0 })
  const [listError, setListError] = useState('')
  const [categories, setCategories] = useState([])
  const [priceBounds, setPriceBounds] = useState({
    floor: 0,
    ceil: DEFAULT_CEIL,
    mode: 'range',
  })
  const [facets, setFacets] = useState({ brands: [], colors: [] })
  const [q, setQ] = useState(() => params.get('search') || '')
  const [category, setCategory] = useState(() => params.get('category') || '')
  const [priceRange, setPriceRange] = useState([0, DEFAULT_CEIL])
  const [ordering, setOrdering] = useState(() => params.get('ordering') || '')
  const [featured, setFeatured] = useState(() => parseFeaturedParam(params.get('is_featured')))
  const [brandFilter, setBrandFilter] = useState(() => params.get('brand') || '')
  const [colorFilters, setColorFilters] = useState(() => parseListParam(params.get('colors')))
  const [inStock, setInStock] = useState(() => parseInStockParam(params.get('in_stock')))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [boundsReady, setBoundsReady] = useState(false)
  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page') || 1) || 1))
  const fetchGen = useRef(0)
  const boundsGen = useRef(0)
  const facetsGen = useRef(0)
  /** 'reset' after user category change; 'preserve' on load / back-forward. */
  const priceBoundsIntentRef = useRef('preserve')

  const debouncedQ = useDebounce(q, 300)
  const debouncedRange = useDebounce(priceRange, 400)

  const urlMin = params.get('min_price') || ''
  const urlMax = params.get('max_price') || ''
  const canFilterPrice = boundsReady && priceBounds.mode === 'range'
  const apiMin = canFilterPrice
    ? debouncedRange[0] > priceBounds.floor
      ? String(debouncedRange[0])
      : ''
    : boundsReady
      ? ''
      : urlMin
  const apiMax = canFilterPrice
    ? debouncedRange[1] < priceBounds.ceil
      ? String(debouncedRange[1])
      : ''
    : boundsReady
      ? ''
      : urlMax

  const paramKey = params.toString()

  const setCategoryFromUser = (next) => {
    priceBoundsIntentRef.current = 'reset'
    setCategory(next)
  }

  const rootCategories = useMemo(() => {
    const childrenOf = categoryChildrenMap(categories)
    return childrenOf.get('root') || []
  }, [categories])

  const activeCategoryName = useMemo(() => {
    if (!category) return 'همه محصولات'
    const cat = categories.find((c) => String(c.id) === String(category))
    return cat?.name || 'محصولات'
  }, [categories, category])

  useEffect(() => {
    let cancelled = false
    shopApi
      .categories({ page_size: 100 })
      .then((catRes) => {
        if (cancelled) return
        const list = catRes.data.results || catRes.data
        setCategories(Array.isArray(list) ? list.filter((c) => c.is_active !== false) : [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Category-scoped price bounds (full matching set — not the current page).
  useEffect(() => {
    const gen = ++boundsGen.current
    setBoundsReady(false)
    shopApi
      .productPriceStats(category ? { category } : {})
      .then((statsRes) => {
        if (gen !== boundsGen.current) return
        const payload = statsRes.data || {}
        const nextBounds = boundsFromStats(payload.min_price, payload.max_price)
        const intent = priceBoundsIntentRef.current
        priceBoundsIntentRef.current = 'preserve'

        setPriceBounds(nextBounds)

        if (nextBounds.mode === 'none') {
          setPriceRange([0, 0])
        } else if (intent === 'reset' || nextBounds.mode === 'single') {
          setPriceRange([nextBounds.floor, nextBounds.ceil])
        } else {
          const urlLo = parsePriceParam(params.get('min_price'), nextBounds.floor)
          const urlHi = parsePriceParam(params.get('max_price'), nextBounds.ceil)
          let lo = clampPrice(urlLo, nextBounds.floor, nextBounds.ceil)
          let hi = clampPrice(urlHi, nextBounds.floor, nextBounds.ceil)
          if (lo > hi) {
            lo = nextBounds.floor
            hi = nextBounds.ceil
          }
          setPriceRange([lo, hi])
        }
        setBoundsReady(true)
      })
      .catch(() => {
        if (gen !== boundsGen.current) return
        priceBoundsIntentRef.current = 'preserve'
        setPriceBounds({ floor: 0, ceil: DEFAULT_CEIL, mode: 'range' })
        setBoundsReady(true)
      })
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: refetch bounds on category only

  // Category-scoped filter facets (brands + colors).
  useEffect(() => {
    const gen = ++facetsGen.current
    shopApi
      .productFacets(category ? { category } : {})
      .then((res) => {
        if (gen !== facetsGen.current) return
        const payload = res.data || {}
        setFacets({
          brands: Array.isArray(payload.brands) ? payload.brands : [],
          colors: Array.isArray(payload.colors) ? payload.colors : [],
        })
      })
      .catch(() => {
        if (gen !== facetsGen.current) return
        setFacets({ brands: [], colors: [] })
      })
  }, [category])

  useEffect(() => {
    if (!categories.length || !category) return
    const ok = categories.some((c) => String(c.id) === String(category))
    if (!ok) {
      priceBoundsIntentRef.current = 'reset'
      setCategory('')
    }
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
      brand: params.get('brand') || '',
      colors: parseListParam(params.get('colors')),
      inStock: parseInStockParam(params.get('in_stock')),
    }).toString()
    const fromState = buildParams({
      search: debouncedQ,
      category,
      minPrice: apiMin,
      maxPrice: apiMax,
      ordering,
      page,
      featured,
      brand: brandFilter,
      colors: colorFilters,
      inStock,
    }).toString()
    if (fromUrl === fromState) return
    setQ(params.get('search') || '')
    const nextCat = params.get('category') || ''
    if (nextCat !== category) {
      priceBoundsIntentRef.current = 'preserve'
      setCategory(nextCat)
    }
    setPage(Math.max(1, Number(params.get('page') || 1) || 1))
    if (boundsReady && priceBounds.mode === 'range') {
      const lo = parsePriceParam(params.get('min_price'), priceBounds.floor)
      const hi = parsePriceParam(params.get('max_price'), priceBounds.ceil)
      setPriceRange([
        clampPrice(lo, priceBounds.floor, priceBounds.ceil),
        clampPrice(hi, priceBounds.floor, priceBounds.ceil),
      ])
    }
    setOrdering(params.get('ordering') || '')
    setFeatured(parseFeaturedParam(params.get('is_featured')))
    setBrandFilter(params.get('brand') || '')
    setColorFilters(parseListParam(params.get('colors')))
    setInStock(parseInStockParam(params.get('in_stock')))
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
      brand: brandFilter,
      colors: colorFilters,
      inStock,
    })
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [
    debouncedQ,
    category,
    apiMin,
    apiMax,
    ordering,
    page,
    featured,
    brandFilter,
    colorFilters,
    inStock,
    params,
    setParams,
  ])

  const filterKey = `${debouncedQ}|${category}|${apiMin}|${apiMax}|${ordering}|${featured ? '1' : '0'}|${brandFilter}|${colorFilters.join(',')}|${inStock}`
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
        brand: brandFilter || undefined,
        colors: colorFilters.length ? colorFilters.join(',') : undefined,
        in_stock: inStock || undefined,
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
  }, [debouncedQ, category, apiMin, apiMax, ordering, featured, brandFilter, colorFilters, inStock, page])

  const list = data.results || data
  const items = Array.isArray(list) ? list : []
  const totalCount = typeof data.count === 'number' ? data.count : items.length
  const pageSize = 24
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)

  const priceFiltered =
    canFilterPrice &&
    (debouncedRange[0] > priceBounds.floor || debouncedRange[1] < priceBounds.ceil)

  const searchActive = Boolean(debouncedQ.trim())
  const facetFiltersActive = Boolean(brandFilter || colorFilters.length || inStock)

  const clearFilters = () => {
    priceBoundsIntentRef.current = 'reset'
    setQ('')
    setOrdering('')
    setFeatured(false)
    setBrandFilter('')
    setColorFilters([])
    setInStock('')
    setPage(1)
    setListError('')
    if (category) {
      setCategory('')
    } else if (priceBounds.mode === 'range') {
      setPriceRange([priceBounds.floor, priceBounds.ceil])
    }
  }

  const hasClearableState = useMemo(
    () => Boolean(searchActive || category || priceFiltered || ordering || featured || facetFiltersActive),
    [searchActive, category, priceFiltered, ordering, featured, facetFiltersActive],
  )

  const panelFiltersActive = useMemo(
    () => Boolean(category || priceFiltered || featured || facetFiltersActive),
    [category, priceFiltered, featured, facetFiltersActive],
  )

  const activeChips = useMemo(() => {
    const chips = []
    if (searchActive) {
      chips.push({ key: 'search', label: `جستجو: ${debouncedQ.trim()}` })
    }
    if (category) {
      chips.push({ key: 'category', label: activeCategoryName })
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
    if (brandFilter) {
      chips.push({ key: 'brand', label: `برند: ${brandFilter}` })
    }
    colorFilters.forEach((hex) => {
      const found = facets.colors.find((c) => c.hex_code === hex)
      chips.push({ key: `color:${hex}`, label: `رنگ: ${found?.name || hex}` })
    })
    if (inStock) {
      chips.push({ key: 'in_stock', label: inStock === 'true' ? 'فقط موجود' : 'ناموجود' })
    }
    if (ordering) {
      const sortLabel = SORT_OPTIONS.find((o) => o.value === ordering)?.label
      if (sortLabel) chips.push({ key: 'ordering', label: sortLabel })
    }
    return chips
  }, [searchActive, debouncedQ, category, activeCategoryName, priceFiltered, debouncedRange, featured, brandFilter, colorFilters, facets.colors, inStock, ordering])

  const removeChip = (key) => {
    if (key === 'search') setQ('')
    else if (key === 'category') setCategoryFromUser('')
    else if (key === 'price' && priceBounds.mode === 'range') {
      setPriceRange([priceBounds.floor, priceBounds.ceil])
    } else if (key === 'featured') setFeatured(false)
    else if (key === 'brand') setBrandFilter('')
    else if (key.startsWith('color:')) {
      const hex = key.slice('color:'.length)
      setColorFilters((prev) => prev.filter((c) => c !== hex))
    } else if (key === 'in_stock') setInStock('')
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
    brand: brandFilter,
    colors: colorFilters,
    inStock,
  }).toString()

  const countLabel = loading
    ? 'در حال بارگذاری…'
    : listError
      ? null
      : totalCount === 0
        ? 'محصولی یافت نشد'
        : `${faDigits(totalCount)} محصول`

  // Root category quick-select pills ("انتخاب کاربرد").
  const isRootActive = (id) => {
    if (!id) return !category
    return String(category) === String(id)
  }

  const priceInputsReady = boundsReady && priceBounds.mode === 'range'

  const setPriceBound = (which, raw) => {
    const n = Number(String(raw).replace(/[^\d]/g, ''))
    const [lo, hi] = priceRange
    if (which === 'lo') {
      const nextLo = clampPrice(Number.isFinite(n) ? n : priceBounds.floor, priceBounds.floor, priceBounds.ceil)
      setPriceRange([Math.min(nextLo, hi), hi])
    } else {
      const nextHi = clampPrice(Number.isFinite(n) ? n : priceBounds.ceil, priceBounds.floor, priceBounds.ceil)
      setPriceRange([lo, Math.max(nextHi, lo)])
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-8 md:py-10">
      <Seo
        title="محصولات"
        description={`کاتالوگ گجت‌ها و لوازم دیجیتال ${brand.name} — فیلتر دسته‌بندی، بازه قیمت و مرتب‌سازی`}
        path={`/products${seoQuery ? `?${seoQuery}` : ''}`}
      />

      {/* Centered page title */}
      <Reveal className="text-center">
        <h1 className="font-display text-3xl font-bold text-ink-900 md:text-4xl">محصولات</h1>
      </Reveal>

      <div className="mt-8 lg:grid lg:grid-cols-[17rem_1fr] lg:items-start lg:gap-6">
        {/* Sticky filter sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain rounded-2xl border border-mist-200/80 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">فیلترها</h2>

            <section className="mt-4 min-w-0">
              <h3 className="label mb-2">دسته‌بندی</h3>
              <div className="max-h-[min(40vh,18rem)] overflow-y-auto overscroll-contain rounded-xl border border-mist-200 bg-white p-1.5">
                <CategoryFilterTree categories={categories} value={category} onChange={setCategoryFromUser} />
              </div>
            </section>

            <section className="mt-5 min-w-0 border-t border-mist-100 pt-5">
              <h3 className="label mb-2">محدوده قیمت (تومان)</h3>
              {!boundsReady ? (
                <div className="mt-2 h-9 animate-pulse rounded-xl bg-mist-100" />
              ) : priceBounds.mode === 'none' ? (
                <p className="mt-1 text-sm leading-6 text-ink-700/55">
                  در این دسته محصولی با قیمت مشخص وجود ندارد؛ فیلتر قیمت غیرفعال است.
                </p>
              ) : priceBounds.mode === 'single' ? (
                <p className="mt-1 rounded-xl border border-mist-200 bg-mist-50 px-3 py-2.5 text-sm font-medium tabular-nums text-ink-900">
                  قیمت یکسان: {toman(priceBounds.floor)}
                </p>
              ) : (
                <>
                  <PriceRangeSlider
                    min={priceBounds.floor}
                    max={priceBounds.ceil}
                    valueMin={priceRange[0]}
                    valueMax={priceRange[1]}
                    step={PRICE_STEP}
                    onChange={setPriceRange}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="shrink-0 text-xs text-ink-700/60">از</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input min-w-0 py-2 text-xs tabular-nums"
                        value={priceRange[0] ? priceRange[0].toLocaleString('fa-IR') : ''}
                        placeholder={toman(priceBounds.floor)}
                        onChange={(e) => setPriceBound('lo', e.target.value)}
                        aria-label="حداقل قیمت"
                      />
                    </label>
                    <span className="shrink-0 text-ink-700/40">–</span>
                    <label className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="shrink-0 text-xs text-ink-700/60">تا</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input min-w-0 py-2 text-xs tabular-nums"
                        value={priceRange[1] ? priceRange[1].toLocaleString('fa-IR') : ''}
                        placeholder={toman(priceBounds.ceil)}
                        onChange={(e) => setPriceBound('hi', e.target.value)}
                        aria-label="حداکثر قیمت"
                      />
                    </label>
                  </div>
                </>
              )}
            </section>

            <div className="mt-5 space-y-5 border-t border-mist-100 pt-5">
              <CollapsibleSection title="برند">
                <BrandSection facets={facets.brands} value={brandFilter} onChange={setBrandFilter} />
              </CollapsibleSection>
              <CollapsibleSection title="رنگ">
                <ColorSection facets={facets.colors} value={colorFilters} onChange={setColorFilters} />
              </CollapsibleSection>
              <CollapsibleSection title="وضعیت موجودی">
                <StockSection value={inStock} onChange={setInStock} />
              </CollapsibleSection>
              <div className="border-t border-mist-100 pt-4">
                <button
                  type="button"
                  aria-pressed={featured}
                  className={cn(
                    'flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-start text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                    featured
                      ? 'border-copper-400/50 bg-copper-500/10 font-semibold text-copper-600'
                      : 'border-mist-200 bg-white font-medium text-ink-900 hover:border-copper-400/35 hover:bg-mist-50',
                  )}
                  onClick={() => setFeatured(!featured)}
                >
                  فقط محصولات ویژه
                  <span
                    className={cn(
                      'inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition',
                      featured ? 'justify-end bg-copper-500' : 'justify-start bg-mist-200',
                    )}
                    aria-hidden
                  >
                    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink-900 md:text-2xl">
            {activeCategoryName}
          </h2>

          {/* Quick category pills */}
          <Reveal className="mt-4 rounded-2xl border border-mist-200/80 bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ink-900">انتخاب کاربرد</p>
            <div className="mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
              <button
                type="button"
                aria-pressed={isRootActive(null)}
                onClick={() => setCategoryFromUser('')}
                className={cn(
                  'min-h-11 shrink-0 cursor-pointer rounded-xl border px-4 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                  isRootActive(null)
                    ? 'border-ink-950 bg-ink-950 text-white'
                    : 'border-mist-200 bg-white text-ink-900 hover:border-copper-400/40 hover:bg-mist-50',
                )}
              >
                همه محصولات
              </button>
              {rootCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isRootActive(cat.id)}
                  onClick={() => setCategoryFromUser(String(cat.id))}
                  className={cn(
                    'min-h-11 shrink-0 cursor-pointer rounded-xl border px-4 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                    isRootActive(cat.id)
                      ? 'border-ink-950 bg-ink-950 text-white'
                      : 'border-mist-200 bg-white text-ink-900 hover:border-copper-400/40 hover:bg-mist-50',
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </Reveal>

          {/* Toolbar — raised stacking context so the sort dropdown paints above cards. */}
          <Reveal className="relative z-30 mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary inline-flex min-h-11 cursor-pointer items-center gap-2 px-4 lg:hidden"
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                فیلترها
                {panelFiltersActive && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-copper-500 px-1.5 text-[10px] font-bold text-white">
                    {faDigits(
                      [category, priceFiltered, featured, brandFilter, colorFilters.length, inStock]
                        .filter(Boolean).length,
                    )}
                  </span>
                )}
              </button>
              {countLabel && (
                <p className="text-sm font-medium tabular-nums text-ink-700/70" aria-live="polite">
                  {countLabel}
                </p>
              )}
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

          <div className="mt-4 flex min-w-0 flex-col gap-3">
            <FilterActiveChips
              chips={activeChips}
              onRemove={removeChip}
              onClearAll={hasClearableState ? clearFilters : undefined}
            />
          </div>

          <div className="mt-2 min-w-0">
            {listError && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
                {listError}
              </p>
            )}
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-2xl bg-mist-100 sm:h-72 sm:aspect-auto"
                  />
                ))}
              </div>
            ) : items.length ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
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
      </div>

      <ProductsFilterPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
        category={category}
        onCategoryChange={setCategoryFromUser}
        priceBounds={priceBounds}
        priceRange={priceRange}
        onPriceChange={setPriceRange}
        boundsReady={boundsReady}
        priceStep={PRICE_STEP}
        featured={featured}
        onFeaturedChange={setFeatured}
        onClearAll={clearFilters}
        hasActiveFilters={panelFiltersActive || searchActive}
        facets={facets}
        brand={brandFilter}
        onBrandChange={setBrandFilter}
        colors={colorFilters}
        onColorsChange={setColorFilters}
        inStock={inStock}
        onInStockChange={setInStock}
      />
    </div>
  )
}
