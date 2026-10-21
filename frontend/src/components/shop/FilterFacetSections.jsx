import { useId, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/format'

/**
 * Collapsible filter section used across the products filter surfaces.
 * Header shows a chevron; content animates open/closed without layout jump.
 */
export function CollapsibleSection({ title, defaultOpen = true, count, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section className="min-w-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="label inline-flex items-center gap-1.5">
            {title}
            {typeof count === 'number' && count > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-copper-500 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-ink-700/40 transition duration-200 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </h3>
      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-1 pt-2">{children}</div>
        </div>
      </div>
    </section>
  )
}

/**
 * Single-select brand list. Empty value = all brands.
 * @param {{facets: {brands: Array<{brand: string}>}, value: string, onChange: (v: string) => void}} props
 */
export function BrandSection({ facets = [], value = '', onChange }) {
  const brands = Array.isArray(facets) ? facets : []
  if (!brands.length) return null

  return (
    <div className="space-y-0.5" role="group" aria-label="برند">
      <button
        type="button"
        aria-pressed={!value}
        className={cn(
          'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-copper-400',
          !value ? 'bg-copper-500/10 font-semibold text-copper-600' : 'font-medium text-ink-900 hover:bg-mist-50',
        )}
        onClick={() => onChange('')}
      >
        <span>همه برندها</span>
        {!value && <Check className="h-4 w-4 shrink-0 text-copper-500" strokeWidth={2} aria-hidden />}
      </button>
      {brands.map((b) => {
        const label = b.brand
        const selected = value === label
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            className={cn(
              'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-copper-400',
              selected ? 'bg-copper-500/10 font-semibold text-copper-600' : 'font-medium text-ink-900 hover:bg-mist-50',
            )}
            onClick={() => onChange(selected ? '' : label)}
          >
            <span className="min-w-0 truncate">{label}</span>
            {selected && <Check className="h-4 w-4 shrink-0 text-copper-500" strokeWidth={2} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Multi-select color swatches. Value is an array of hex codes.
 * @param {{facets: Array<{name: string, hex_code: string, product_count: number}>, value: string[], onChange: (v: string[]) => void}} props
 */
export function ColorSection({ facets = [], value = [], onChange }) {
  const colors = Array.isArray(facets) ? facets : []
  if (!colors.length) return null

  const selected = new Set(value)
  const toggle = (hex) => {
    const next = new Set(selected)
    if (next.has(hex)) next.delete(hex)
    else next.add(hex)
    onChange([...next])
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="رنگ">
      {colors.map((c) => {
        const hex = c.hex_code
        const active = selected.has(hex)
        return (
          <button
            key={hex}
            type="button"
            aria-pressed={active}
            aria-label={c.name || hex}
            title={c.name || hex}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-copper-400',
              active
                ? 'border-copper-400/60 bg-copper-500/10 font-semibold text-copper-600'
                : 'border-mist-200 bg-white text-ink-900 hover:border-copper-400/35 hover:bg-mist-50',
            )}
            onClick={() => toggle(hex)}
          >
            <span
              className="inline-block h-4 w-4 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: hex }}
              aria-hidden
            />
            <span className="min-w-0 truncate">{c.name || hex}</span>
            {active && <Check className="h-3.5 w-3.5 shrink-0 text-copper-500" strokeWidth={2} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

const STOCK_OPTIONS = [
  { value: '', label: 'همه محصولات' },
  { value: 'true', label: 'فقط موجود' },
  { value: 'false', label: 'ناموجود' },
]

/** Single-select stock availability. Value: '' | 'true' | 'false'. */
export function StockSection({ value = '', onChange }) {
  return (
    <div className="space-y-0.5" role="group" aria-label="وضعیت موجودی">
      {STOCK_OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value || 'all'}
            type="button"
            aria-pressed={selected}
            className={cn(
              'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-copper-400',
              selected ? 'bg-copper-500/10 font-semibold text-copper-600' : 'font-medium text-ink-900 hover:bg-mist-50',
            )}
            onClick={() => onChange(opt.value)}
          >
            <span>{opt.label}</span>
            {selected && <Check className="h-4 w-4 shrink-0 text-copper-500" strokeWidth={2} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
