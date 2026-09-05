import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpLeft, LayoutGrid } from 'lucide-react'
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
    <div className="space-y-10">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-mist-100" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <div className="h-44 animate-pulse rounded-3xl bg-mist-100 sm:h-52" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="aspect-[4/3] animate-pulse rounded-2xl bg-mist-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CategoriesPage() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeRootId, setActiveRootId] = useState('all')

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

  const visibleRoots = useMemo(() => {
    if (activeRootId === 'all') return roots
    return roots.filter((r) => String(r.id) === String(activeRootId))
  }, [roots, activeRootId])

  const subCount = cats.length - roots.length

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
            از دسته اصلی شروع کنید یا مستقیم وارد زیردسته شوید.
          </p>
          {!loading && cats.length > 0 && (
            <p className="mt-5 text-xs text-white/40">
              <span className="text-white/75">{faDigits(roots.length)}</span> دسته
              {subCount > 0 ? (
                <>
                  {' '}
                  · <span className="text-white/75">{faDigits(subCount)}</span> زیردسته
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
            {/* Root filter — modern chip rail */}
            <Reveal className="mb-8 sm:mb-10">
              <div
                role="tablist"
                aria-label="فیلتر دسته اصلی"
                className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeRootId === 'all'}
                  onClick={() => setActiveRootId('all')}
                  className={cn(
                    'shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                    activeRootId === 'all'
                      ? 'bg-ink-900 text-white shadow-soft'
                      : 'border border-mist-200 bg-white text-ink-800 hover:border-copper-400/40',
                  )}
                >
                  همه دسته‌ها
                </button>
                {roots.map((root) => {
                  const active = String(activeRootId) === String(root.id)
                  const n = (childrenOf.get(String(root.id)) || []).length
                  return (
                    <button
                      key={root.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveRootId(String(root.id))}
                      className={cn(
                        'inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                        active
                          ? 'bg-ink-900 text-white shadow-soft'
                          : 'border border-mist-200 bg-white text-ink-800 hover:border-copper-400/40',
                      )}
                    >
                      {root.name}
                      {n > 0 ? (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                            active ? 'bg-white/15 text-white/80' : 'bg-mist-100 text-ink-700/55',
                          )}
                        >
                          {faDigits(n)}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </Reveal>

            <div className="space-y-12 sm:space-y-14">
              {visibleRoots.map((root, rootIndex) => {
                const subs = childrenOf.get(String(root.id)) || []
                return (
                  <Reveal key={root.id} delay={Math.min(rootIndex, 4) * 45} className="min-w-0">
                    <div id={`cat-${root.id}`} className="scroll-mt-28 space-y-4 sm:space-y-5">
                      {/* Parent category — featured banner */}
                      <Link
                        to={`/products?category=${root.id}`}
                        className="group relative block min-h-[11rem] cursor-pointer overflow-hidden rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-copper-400 focus-visible:ring-offset-2 sm:min-h-[13rem]"
                      >
                        <div className="absolute inset-0 bg-ink-950">
                          <MediaFill category={root} letterClass="text-6xl sm:text-7xl" />
                        </div>
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/15"
                          aria-hidden
                        />
                        <div className="relative flex h-full min-h-[11rem] flex-col justify-end p-5 sm:min-h-[13rem] sm:p-7 md:p-8">
                          <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="min-w-0 max-w-xl">
                              <p className="text-[11px] font-semibold tracking-wide text-copper-400">
                                دسته اصلی
                                {subs.length > 0 ? (
                                  <>
                                    {' '}
                                    · {faDigits(subs.length)} زیردسته
                                  </>
                                ) : null}
                              </p>
                              <h2 className="mt-1.5 font-display text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                                {root.name}
                              </h2>
                              {root.description ? (
                                <p className="mt-2 line-clamp-2 text-sm leading-7 text-white/55">
                                  {root.description}
                                </p>
                              ) : (
                                <p className="mt-2 text-sm text-white/50">
                                  مشاهده همه محصولات این دسته
                                </p>
                              )}
                            </div>
                            <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-copper-500 px-4 text-sm font-semibold text-white shadow-soft transition duration-300 group-hover:bg-copper-600">
                              ورود به دسته
                              <ArrowUpLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
                            </span>
                          </div>
                        </div>
                      </Link>

                      {/* Subcategories — equal visual grid */}
                      {subs.length > 0 ? (
                        <div>
                          <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
                            <h3 className="text-sm font-semibold text-ink-800">زیردسته‌ها</h3>
                            <span className="text-xs text-ink-700/40">{faDigits(subs.length)} مورد</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
                            {subs.map((child, i) => (
                              <SubCard key={child.id} category={child} index={i} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-mist-200 bg-white/60 px-4 py-5 text-center text-sm text-ink-700/45">
                          برای این دسته هنوز زیردسته‌ای تعریف نشده است.
                        </p>
                      )}
                    </div>
                  </Reveal>
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
