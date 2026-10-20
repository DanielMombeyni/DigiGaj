import { cn } from '@/utils/format'

/**
 * Vertical card specification rows (RTL: title on the right, value on the left).
 * Shared by all full ProductCard surfaces. Plain text only — never HTML.
 * Only populated {title, value} slots are rendered (empty area omitted).
 */
export default function ProductCardSpecs({ specs, dense = false, className = '' }) {
  const rows = Array.isArray(specs)
    ? specs
        .filter((s) => s && String(s.title || '').trim() && String(s.value || '').trim())
        .slice(0, 4)
        .map((s) => ({
          title: String(s.title).trim(),
          value: String(s.value).trim(),
        }))
    : []
  if (!rows.length) return null

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col overflow-hidden',
        dense ? 'mt-1.5 gap-1' : 'mt-2 gap-1.5',
        className,
      )}
      dir="rtl"
    >
      {rows.map((row, i) => (
        <div
          key={`${row.title}-${i}`}
          className={cn(
            'flex w-full min-w-0 items-start justify-between gap-1.5 rounded-md border border-sea-400/35 bg-mist-50 text-ink-800 sm:gap-2',
            dense ? 'px-1.5 py-1' : 'px-2 py-1.5',
          )}
        >
          <span
            className={cn(
              'min-w-0 flex-1 break-words text-start font-medium leading-snug text-sea-700',
              dense ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-[13px]',
            )}
          >
            <span className="[unicode-bidi:isolate]" dir="auto">
              {row.title}
            </span>
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 break-words text-end font-semibold leading-snug text-ink-900',
              dense ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-[13px]',
            )}
          >
            <span className="[unicode-bidi:isolate]" dir="auto">
              {row.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
