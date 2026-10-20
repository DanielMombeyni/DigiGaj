import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Star, X } from 'lucide-react'
import CategoryFilterTree from '@/components/shop/CategoryFilterTree'
import PriceRangeSlider from '@/components/shop/PriceRangeSlider'
import { cn, toman } from '@/utils/format'

/**
 * Unified Concept B filter surface:
 * - md+: side drawer from inline-start (RTL → right)
 * - <md: bottom sheet
 * Filters apply immediately; closing keeps current selections.
 */
export default function ProductsFilterPanel({
  open,
  onClose,
  categories,
  category,
  onCategoryChange,
  priceBounds,
  priceRange,
  onPriceChange,
  boundsReady,
  priceStep = 100_000,
  featured,
  onFeaturedChange,
  onClearAll,
  hasActiveFilters,
}) {
  const titleId = useId()
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel || panel.contains(document.activeElement)) return
      const closeBtn = panel.querySelector('[data-filter-close]')
      closeBtn?.focus?.()
    }, 30)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-ink-950/50 touch-auto"
        aria-label="بستن فیلترها"
        onClick={onClose}
        data-filter-close-backdrop
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'absolute z-[121] flex max-h-[92vh] flex-col overflow-hidden border-mist-200 bg-surface shadow-[0_24px_64px_rgba(15,23,42,0.22)]',
          // Mobile: bottom sheet
          'inset-x-0 bottom-0 rounded-t-2xl border-t animate-rise',
          // Desktop: start-side drawer (RTL-aware)
          'md:inset-y-0 md:bottom-auto md:start-0 md:end-auto md:h-full md:max-h-none md:w-full md:max-w-sm md:rounded-none md:border-e md:border-t-0 md:shadow-soft',
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-mist-100 px-4 py-3.5">
          <h2 id={titleId} className="font-display text-base font-bold text-ink-900 md:text-lg">
            فیلترها
          </h2>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-sea-600 transition hover:bg-sea-50 hover:text-copper-600"
                onClick={onClearAll}
              >
                پاک کردن همه
              </button>
            )}
            <button
              type="button"
              data-filter-close
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-mist-50 text-ink-700/60 transition hover:bg-mist-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
              aria-label="بستن"
              onClick={onClose}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <section className="min-w-0">
            <h3 className="label mb-2">دسته‌بندی</h3>
            <div className="max-h-[min(40vh,18rem)] overflow-y-auto overscroll-contain rounded-xl border border-mist-200 bg-white p-1.5 md:max-h-[min(50vh,22rem)]">
              <CategoryFilterTree
                categories={categories}
                value={category}
                onChange={onCategoryChange}
              />
            </div>
          </section>

          <section className="mt-5 min-w-0 border-t border-mist-100 pt-5">
            <h3 className="label mb-2">بازه قیمت (تومان)</h3>
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
              <PriceRangeSlider
                min={priceBounds.floor}
                max={priceBounds.ceil}
                valueMin={priceRange[0]}
                valueMax={priceRange[1]}
                step={priceStep}
                onChange={onPriceChange}
              />
            )}
          </section>

          <section className="mt-5 min-w-0 border-t border-mist-100 pt-5">
            <h3 className="label mb-2">سایر فیلترها</h3>
            <button
              type="button"
              aria-pressed={featured}
              className={cn(
                'flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-start text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
                featured
                  ? 'border-copper-400/50 bg-copper-500/10 font-semibold text-copper-600'
                  : 'border-mist-200 bg-white font-medium text-ink-900 hover:border-copper-400/35 hover:bg-mist-50',
              )}
              onClick={() => onFeaturedChange(!featured)}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <Star
                  className={cn('h-4 w-4 shrink-0', featured ? 'fill-copper-500 text-copper-500' : 'text-ink-700/40')}
                  strokeWidth={1.75}
                  aria-hidden
                />
                فقط محصولات ویژه
              </span>
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
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
