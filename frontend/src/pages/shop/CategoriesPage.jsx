import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpLeft } from 'lucide-react'
import { shopApi } from '@/services/api'
import { mediaSrc } from '@/utils/media'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { cn, faDigits } from '@/utils/format'

function MediaFill({ category, letterClass = 'text-5xl' }) {
  if (category.image) {
    return (
      <img
        src={mediaSrc(category.image)}
        alt=""
        className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        loading="lazy"
      />
    )
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-sea-600/35"
      aria-hidden
    >
      <span className={cn('font-display font-bold text-white/15', letterClass)}>
        {category.name?.slice(0, 1)}
      </span>
    </div>
  )
}

function SubTile({ category, index = 0 }) {
  return (
    <Link
      to={`/products?category=${category.id}`}
      className="group flex min-w-[9.5rem] snap-start flex-col outline-none focus-visible:ring-2 focus-visible:ring-copper-400 focus-visible:ring-offset-2 sm:min-w-0"
      style={{ transitionDelay: `${Math.min(index, 10) * 35}ms` }}
    >
      <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-ink-950">
        <MediaFill category={category} letterClass="text-3xl sm:text-4xl" />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink-950/55 via-transparent to-transparent opacity-70"
          aria-hidden
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 px-0.5">
        <span className="min-w-0 truncate text-sm font-semibold text-ink-900 transition group-hover:text-copper-600">
          {category.name}
        </span>
        <ArrowUpLeft
          className="h-3.5 w-3.5 shrink-0 text-ink-700/30 transition group-hover:text-copper-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:translate-x-0"
          strokeWidth={2}
          aria-hidden
        />
      </div>
    </Link>
  )
}

function CategoriesSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
      <div className="hidden space-y-2 lg:block">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-mist-100" />
        ))}
      </div>
      <div className="space-y-12">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <div className="h-[18rem] animate-pulse rounded-2xl bg-mist-100 sm:h-[22rem]" />
            <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="aspect-[5/4] w-40 shrink-0 animate-pulse rounded-2xl bg-mist-100 sm:w-auto" />
              ))}
            </div>
          </div>
        ))}
      </div>
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

  const subCount = Math.max(0, cats.length - roots.length)

  return (
    <div className="min-w-0 overflow-x-clip">
      <Seo
        title="دسته‌بندی‌ها"
        description={`مرور دسته‌بندی‌های ${brand.name}. هدفون، ساعت هوشمند، لوازم موبایل و گیمینگ`}
        path="/categories"
      />

      {/* Full-bleed hero: brand first, one composition */}
      <section className="relative overflow-hidden bg-hero-mesh text-white">
        <div className="hero-noise absolute inset-0 opacity-[0.28]" aria-hidden />
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -start-16 top-10 h-52 w-52 rounded-full bg-sea-500/20 blur-3xl animate-orb-slow" />
          <div className="absolute -end-10 bottom-0 h-56 w-56 rounded-full bg-copper-400/18 blur-3xl animate-orb" />
        </div>

        <div className="relative mx-auto grid min-h-[min(72dvh,36rem)] max-w-6xl items-end gap-10 px-4 pb-12 pt-16 sm:pb-14 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-14 lg:pb-16 lg:pt-20">
          <Reveal className="min-w-0">
            <p className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              {brand.name}
            </p>
            <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-white/90 sm:text-3xl md:text-4xl">
              دسته‌بندی‌ها
            </h1>
            <p className="mt-3 max-w-[28ch] text-sm leading-7 text-white/55 sm:max-w-md sm:text-base sm:leading-8">
              مسیر خرید را از دسته اصلی یا زیردسته شروع کنید.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/products" className="btn-primary min-h-11 cursor-pointer px-6 active:scale-[0.98]">
                همه محصولات
              </Link>
              {!loading && cats.length > 0 ? (
                <p className="text-xs text-white/40">
                  <span className="tabular-nums text-white/70">{faDigits(roots.length)}</span>
                  {' '}
                  دسته
                  {subCount > 0 ? (
                    <>
                      {' '}
                      و
                      {' '}
                      <span className="tabular-nums text-white/70">{faDigits(subCount)}</span>
                      {' '}
                      زیردسته
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </Reveal>

          <Reveal delay={80} className="relative hidden min-h-[14rem] lg:block">
            <div className="absolute inset-y-4 start-8 end-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/40">
              {roots[0] ? (
                <MediaFill category={roots[0]} letterClass="text-8xl" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-ink-900 to-sea-600/30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-l from-ink-950/10 via-transparent to-ink-950/70" aria-hidden />
            </div>
            <div className="absolute -start-2 bottom-0 top-12 w-[55%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              {roots[1] ? (
                <MediaFill category={roots[1]} letterClass="text-6xl" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-copper-600/40 to-ink-900" />
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl min-w-0 px-4 py-10 sm:py-12 md:py-14">
        {loading ? (
          <CategoriesSkeleton />
        ) : roots.length === 0 ? (
          <div className="px-1 py-16 text-center">
            <p className="text-sm text-ink-700/55">هنوز دسته‌بندی‌ای ثبت نشده است.</p>
            <Link to="/products" className="btn-primary mt-6 inline-flex min-h-11 cursor-pointer">
              مشاهده محصولات
            </Link>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
            {/* Desktop sticky index */}
            <aside className="hidden lg:block">
              <nav
                aria-label="فهرست دسته‌های اصلی"
                className="sticky top-28 space-y-1 border-s border-mist-200 ps-4"
              >
                <button
                  type="button"
                  onClick={() => setActiveRootId('all')}
                  className={cn(
                    'block w-full cursor-pointer rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                    activeRootId === 'all'
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-700 hover:bg-mist-100 hover:text-ink-900',
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
                      onClick={() => setActiveRootId(String(root.id))}
                      className={cn(
                        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                        active
                          ? 'bg-ink-900 text-white'
                          : 'text-ink-700 hover:bg-mist-100 hover:text-ink-900',
                      )}
                    >
                      <span className="min-w-0 truncate">{root.name}</span>
                      {n > 0 ? (
                        <span
                          className={cn(
                            'shrink-0 tabular-nums text-[11px]',
                            active ? 'text-white/55' : 'text-ink-700/40',
                          )}
                        >
                          {faDigits(n)}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <div className="min-w-0">
              {/* Mobile index rail */}
              <div
                role="tablist"
                aria-label="فیلتر دسته اصلی"
                className="mb-8 flex gap-1 overflow-x-auto border-b border-mist-200 pb-px [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeRootId === 'all'}
                  onClick={() => setActiveRootId('all')}
                  className={cn(
                    'shrink-0 cursor-pointer border-b-2 px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                    activeRootId === 'all'
                      ? 'border-copper-500 text-ink-900'
                      : 'border-transparent text-ink-700/55 hover:text-ink-800',
                  )}
                >
                  همه
                </button>
                {roots.map((root) => {
                  const active = String(activeRootId) === String(root.id)
                  return (
                    <button
                      key={root.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveRootId(String(root.id))}
                      className={cn(
                        'shrink-0 cursor-pointer border-b-2 px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                        active
                          ? 'border-copper-500 text-ink-900'
                          : 'border-transparent text-ink-700/55 hover:text-ink-800',
                      )}
                    >
                      {root.name}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-14 sm:space-y-16">
                {visibleRoots.map((root, rootIndex) => {
                  const subs = childrenOf.get(String(root.id)) || []
                  const featured = rootIndex === 0 && activeRootId === 'all'

                  return (
                    <Reveal key={root.id} delay={Math.min(rootIndex, 4) * 40} className="min-w-0">
                      <article id={`cat-${root.id}`} className="scroll-mt-28">
                        <Link
                          to={`/products?category=${root.id}`}
                          className={cn(
                            'group relative block cursor-pointer overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-copper-400 focus-visible:ring-offset-2',
                            featured ? 'min-h-[20rem] sm:min-h-[24rem]' : 'min-h-[15rem] sm:min-h-[17rem]',
                          )}
                        >
                          <div className="absolute inset-0 bg-ink-950">
                            <MediaFill
                              category={root}
                              letterClass={featured ? 'text-7xl sm:text-8xl' : 'text-6xl sm:text-7xl'}
                            />
                          </div>
                          <div
                            className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-ink-950/10"
                            aria-hidden
                          />
                          <div
                            className={cn(
                              'relative flex h-full flex-col justify-end p-5 sm:p-7 md:p-8',
                              featured ? 'min-h-[20rem] sm:min-h-[24rem]' : 'min-h-[15rem] sm:min-h-[17rem]',
                            )}
                          >
                            <div className="flex flex-wrap items-end justify-between gap-4">
                              <div className="min-w-0 max-w-xl">
                                <h2
                                  className={cn(
                                    'font-display font-bold text-white',
                                    featured
                                      ? 'text-3xl sm:text-4xl md:text-5xl'
                                      : 'text-2xl sm:text-3xl md:text-4xl',
                                  )}
                                >
                                  {root.name}
                                </h2>
                                {root.description ? (
                                  <p className="mt-2 line-clamp-2 max-w-[42ch] text-sm leading-7 text-white/55">
                                    {root.description}
                                  </p>
                                ) : (
                                  <p className="mt-2 text-sm text-white/50">
                                    مشاهده محصولات این دسته
                                  </p>
                                )}
                                {subs.length > 0 ? (
                                  <p className="mt-3 text-xs tabular-nums text-white/35">
                                    {faDigits(subs.length)} زیردسته
                                  </p>
                                ) : null}
                              </div>
                              <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-copper-500 px-4 text-sm font-semibold text-white shadow-soft transition duration-300 group-hover:bg-copper-600 group-active:scale-[0.98]">
                                ورود به دسته
                                <ArrowUpLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </span>
                            </div>
                          </div>
                        </Link>

                        {subs.length > 0 ? (
                          <div className="mt-5 sm:mt-6">
                            <div className="mb-3 flex items-baseline justify-between gap-3">
                              <h3 className="text-sm font-semibold text-ink-800">زیردسته‌ها</h3>
                              <span className="text-xs tabular-nums text-ink-700/40">
                                {faDigits(subs.length)}
                              </span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
                              {subs.map((child, i) => (
                                <SubTile key={child.id} category={child} index={i} />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    </Reveal>
                  )
                })}
              </div>

              <Reveal className="mt-16 border-t border-mist-200 pt-10 sm:mt-20 sm:pt-12">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 max-w-md">
                    <h2 className="font-display text-xl font-bold text-ink-900 sm:text-2xl">
                      جست‌وجوی آزاد
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-ink-700/55">
                      اگر دسته مشخصی مد نظرتان نیست، از صفحه اصلی یا جست‌وجو شروع کنید.
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
        )}
      </section>
    </div>
  )
}
