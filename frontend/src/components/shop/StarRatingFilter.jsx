import { Star } from 'lucide-react'

/**
 * Minimum star rating filter (1–5). Empty = all ratings.
 */
export default function StarRatingFilter({ value, onChange }) {
  const min = value ? Number(value) : 0

  return (
    <div className="min-w-0">
      <span className="label">حداقل امتیاز</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange('')}
          className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition ${
            !min
              ? 'bg-ink-950 text-white'
              : 'bg-mist-100 text-ink-700/70 hover:bg-mist-200'
          }`}
        >
          همه
        </button>
        <div
          className="flex min-w-0 flex-1 items-center gap-0.5 rounded-xl border border-mist-200 bg-white px-2 py-1.5"
          role="group"
          aria-label="انتخاب حداقل امتیاز"
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= min
            return (
              <button
                key={star}
                type="button"
                aria-label={`حداقل ${star} ستاره`}
                aria-pressed={min === star}
                className="cursor-pointer rounded-lg p-1.5 transition hover:bg-amber-50 active:scale-95"
                onClick={() => onChange(min === star ? '' : String(star))}
              >
                <Star
                  className={`h-6 w-6 sm:h-5 sm:w-5 ${
                    filled ? 'fill-amber-400 text-amber-400' : 'text-mist-200'
                  }`}
                  strokeWidth={1.5}
                />
              </button>
            )
          })}
        </div>
        {min > 0 && (
          <span className="text-xs text-ink-700/55">{min} ستاره به بالا</span>
        )}
      </div>
    </div>
  )
}
