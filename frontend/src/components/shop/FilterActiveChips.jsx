import { X } from 'lucide-react'
import { cn } from '@/utils/format'

/**
 * Removable active-filter chips for the products listing.
 * Each chip maps to one filter key; clear-all is optional.
 */
export default function FilterActiveChips({ chips = [], onRemove, onClearAll, className = '' }) {
  if (!chips.length) return null

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-xl border border-mist-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-900 shadow-sm transition hover:border-copper-400/40 hover:bg-mist-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
          onClick={() => onRemove(chip.key)}
          aria-label={`حذف فیلتر ${chip.label}`}
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <X className="h-3.5 w-3.5 shrink-0 text-ink-700/45" strokeWidth={2} aria-hidden />
        </button>
      ))}
      {onClearAll && (
        <button
          type="button"
          className="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium text-sea-600 transition hover:bg-sea-50 hover:text-copper-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
          onClick={onClearAll}
        >
          پاک کردن همه
        </button>
      )}
    </div>
  )
}
