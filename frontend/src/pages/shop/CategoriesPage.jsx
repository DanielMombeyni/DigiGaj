import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpLeft, ChevronDown, LayoutGrid } from 'lucide-react'
import { shopApi } from '@/services/api'
import { mediaSrc } from '@/utils/media'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { cn, faDigits } from '@/utils/format'

function MediaFill({ category, letterClass = 'text-4xl' }) {
  if (category.image) {
    return (
      <img
        src={mediaSrc(category.image)}
        alt=""
        className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        loading="lazy"
      />
    )
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-sea-600/40"
      aria-hidden
    >
      <span className={cn('font-display font-bold text-white/18', letterClass)}>
        {category.name?.slice(0, 1)}
      </span>
    </div>
  )
}

function SubCard({ category, index = 0 }) {
  return (
    <Link
      to={`/products?category=${category.id}`}
      className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-mist-200 bg-white outline-none transition duration-300 hover:-translate-y-0.5 hover:border-copper-400/35 hover:shadow-soft focus-visible:ring-2 focus-visible:ring-copper-400 motion-reduce:hover:translate-y-0"
      style={{ transitionDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-950">
        <MediaFill category={category} letterClass="text-3xl sm:text-4xl" />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent opacity-80"
          aria-hidden
        />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-3 py-3 sm:px-3.5 sm:py-3.5">
        <span className="min-w-0 truncate font-display text-sm font-semibold text-ink-900 transition group-hover:text-copper-600">
          {category.name}
        </span>
        <ArrowUpLeft
          className="h-3.5 w-3.5 shrink-0 text-ink-700/35 transition group-hover:text-copper-500"
          strokeWidth={2}
          aria-hidden
        />
      </div>
    </Link>
  )
}

function CategoriesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-mist-100" />
      ))}
    </div>
  )
}

function panelRef(open) {
  return (node) => {
    if (!node) return
    if (open) node.removeAttribute('inert')
    else node.setAttribute('inert', '')
  }
}

function SubPanel({ items, childrenOf }) {
  const [openId, setOpenId] = useState(null)
  const leavesOnly = items.every((c) => (childrenOf.get(String(c.id)) || []).length === 0)

  if (leavesOnly) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {items.map((child, i) => (
          <SubCard key={child.id} category={child} index={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((child) => {
        const kids = childrenOf.get(String(child.id)) || []
        const open = openId === String(child.id)
        if (kids.length === 0) {
          return (
            <Link
              key={child.id}
              to={`/products?category=${child.id}`}
              className="group flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-mist-200 bg-white px-3 py-2.5 outline-none transition hover:border-copper-400/40 focus-visible:ring-2 focus-visible:ring-copper-400"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-ink-900 group-hover:text-copper-600">
                {child.name}
              </span>
              <ArrowUpLeft className="h-3.5 w-3.5 shrink-0 text-ink-700/35 group-hover:text-copper-500" strokeWidth={2} aria-hidden />
            </Link>
          )
        }
        return (
          <div key={child.id} className="overflow-hidden rounded-xl border border-mist-200 bg-white">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`sub-${child.id}`}
              onClick={() => setOpenId(open ? null : String(child.id))}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper-400"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-ink-900">{child.name}</span>
              <span className="inline-flex shrink-0 items-center gap-2 text-xs text-ink-700/45">
                {faDigits(kids.length)} زیردسته
                <ChevronDown
                  className={cn('h-4 w-4 transition duration-200 motion-reduce:transition-none', open && 'rotate-180')}
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
            </button>
            <div
              id={`sub-${child.id}`}
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="min-h-0 overflow-hidden" ref={panelRef(open)}>
                <div className="border-t border-mist-100 px-3 py-3">
                  <SubPanel items={kids} childrenOf={childrenOf} />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CategoriesPage() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let cancelled = false
    shopApi
      .categories({ page_size: 100 })
      .then((r) => {
        if (!cancelled) setCats(r.data.results || r.data)
      })
      .catch(() => {
        if (!cancelled) setCats([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const roots = useMemo(() => {
    const list = cats.filter((c) => c.parent == null)
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'fa'))
    return list
  }, [cats])

  const childrenOf = useMemo(() => {
    const map = new Map()
    for (const c of cats) {
      if (c.parent == null) continue
      const key = String(c.parent)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(c)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'fa'))
    }
    return map
  }, [cats])

  const toggleRoot = (id) => {
    const next = String(id)
    setOpenId((current) => (current === next ? null : next))
  }

  return (
    <div className="min-w-0 overflow-x-clip">
      <Seo
        title="دسته‌بندی‌ها"
        description={`مرور دسته‌بندی‌های ${brand.name} — هدفون، ساعت هوشمند، لوازم موبایل و گیمینگ`}
        path="/categories"
      />

      {/* Brand-aligned intro */}
      <section className="relative overflow-hidden bg-hero-mesh px-4 pb-12 pt-14 text-white sm:pb-14 sm:pt-16">
        <div className="hero-noise absolute inset-0 opacity-[0.28]" aria-hidden />
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-sea-500/25 blur-3xl animate-orb-slow" />
          <div className="absolute -right-8 bottom-0 h-48 w-48 rounded-full bg-copper-400/20 blur-3xl animate-orb" />
        </div>
        <Reveal className="relative mx-auto max-w-6xl min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-copper-400">
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            {brand.name}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            دسته‌بندی‌ها
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-7 text-white/60 sm:text-base sm:leading-8">
            از دسته اصلی شروع کنید؛ با هر کلیک زیردسته‌ها باز می‌شوند.
          </p>
          {!loading && cats.length > 0 && (
            <p className="mt-5 text-xs text-white/40">
              <span className="text-white/75">{faDigits(roots.length)}</span> دسته
              {cats.length - roots.length > 0 ? (
                <>
                  {' '}
                  · <span className="text-white/75">{faDigits(cats.length - roots.length)}</span> زیردسته
                </>
              ) : null}
            </p>
          )}
        </Reveal>
      </section>

      <section className="relative mx-auto max-w-6xl min-w-0 px-4 py-8 sm:py-10 md:py-12">
        {loading ? (
          <CategoriesSkeleton />
        ) : roots.length === 0 ? (
          <div className="rounded-3xl border border-mist-200 bg-white px-5 py-14 text-center shadow-soft sm:px-6">
            <p className="text-sm text-ink-700/55">هنوز دسته‌بندی‌ای ثبت نشده است.</p>
            <Link to="/products" className="btn-primary mt-6 inline-flex min-h-11 cursor-pointer">
              مشاهده محصولات
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {roots.map((root) => {
                const subs = childrenOf.get(String(root.id)) || []
                const open = openId === String(root.id)
                const panelId = `cat-panel-${root.id}`

                if (subs.length === 0) {
                  return (
                    <Link
                      key={root.id}
                      id={`cat-${root.id}`}
                      to={`/products?category=${root.id}`}
                      className="group flex min-h-16 cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-mist-200 bg-white px-3 py-2.5 outline-none transition hover:border-copper-400/40 hover:shadow-soft focus-visible:ring-2 focus-visible:ring-copper-400 sm:gap-4 sm:px-4"
                    >
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ink-950">
                        <MediaFill category={root} letterClass="text-lg" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-bold text-ink-900 group-hover:text-copper-600 sm:text-lg">
                          {root.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-700/45">
                          {root.description || 'مشاهده محصولات این دسته'}
                        </span>
                      </span>
                      <ArrowUpLeft className="h-4 w-4 shrink-0 text-ink-700/35 group-hover:text-copper-500" strokeWidth={2} aria-hidden />
                    </Link>
                  )
                }

                return (
                  <div
                    key={root.id}
                    id={`cat-${root.id}`}
                    className={cn(
                      'scroll-mt-28 overflow-hidden rounded-2xl border bg-white transition duration-200',
                      open ? 'border-copper-400/40 shadow-soft' : 'border-mist-200',
                    )}
                  >
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggleRoot(root.id)}
                        className="flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper-400 sm:gap-4 sm:px-4"
                      >
                        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ink-950">
                          <MediaFill category={root} letterClass="text-lg" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-base font-bold text-ink-900 sm:text-lg">
                            {root.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-700/45">
                            {faDigits(subs.length)} زیردسته
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-5 w-5 shrink-0 text-ink-700/45 transition duration-200 motion-reduce:transition-none',
                            open && 'rotate-180 text-copper-500',
                          )}
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                      <Link
                        to={`/products?category=${root.id}`}
                        className="hidden shrink-0 items-center px-4 text-sm font-semibold text-copper-600 outline-none hover:text-copper-500 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper-400 sm:inline-flex"
                      >
                        محصولات
                      </Link>
                    </div>
                    <div
                      id={panelId}
                      role="region"
                      aria-label={`زیردسته‌های ${root.name}`}
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="min-h-0 overflow-hidden" ref={panelRef(open)}>
                        <div className="border-t border-mist-100 bg-mist-50/70 px-3 py-3 sm:px-4 sm:py-4">
                          <SubPanel items={subs} childrenOf={childrenOf} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <Reveal className="mt-12 overflow-hidden rounded-3xl border border-mist-200 bg-ink-950 px-5 py-9 text-center text-white sm:mt-14 sm:px-8 sm:py-10">
              <h2 className="font-display text-xl font-bold sm:text-2xl">جست‌وجوی آزاد در فروشگاه</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/50">
                اگر دسته مشخصی مد نظرتان نیست، همه محصولات را با فیلتر قیمت و امتیاز ببینید.
              </p>
              <Link
                to="/products"
                className="btn-primary mt-6 inline-flex min-h-11 cursor-pointer px-6"
              >
                همه محصولات
              </Link>
            </Reveal>
          </>
        )}
      </section>
    </div>
  )
}
