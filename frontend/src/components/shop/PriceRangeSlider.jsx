import { useMemo } from 'react'
import { toman } from '@/utils/format'

/**
 * Dual-thumb price range slider. Track uses LTR so thumbs match min (left) / max (right).
 */
export default function PriceRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  step = 100_000,
  onChange,
  className = '',
}) {
  const pct = useMemo(() => {
    const span = Math.max(max - min, 1)
    return {
      lo: ((valueMin - min) / span) * 100,
      hi: ((valueMax - min) / span) * 100,
    }
  }, [min, max, valueMin, valueMax])

  const setLo = (raw) => {
    const next = Math.min(Number(raw), valueMax - step)
    onChange([Math.max(min, next), valueMax])
  }

  const setHi = (raw) => {
    const next = Math.max(Number(raw), valueMin + step)
    onChange([valueMin, Math.min(max, next)])
  }

  return (
    <div className={`min-w-0 ${className}`} dir="ltr">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-700/70">
        <span className="rounded-lg bg-mist-100 px-2 py-1 tabular-nums">{toman(valueMin)}</span>
        <span className="text-ink-700/40">تا</span>
        <span className="rounded-lg bg-mist-100 px-2 py-1 tabular-nums">{toman(valueMax)}</span>
      </div>
      <div className="price-range relative mx-1 h-9 touch-pan-y">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-mist-200" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-copper-500"
          style={{
            left: `${pct.lo}%`,
            width: `${Math.max(pct.hi - pct.lo, 0)}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => setLo(e.target.value)}
          aria-label="حداقل قیمت"
          className="price-range-input"
          style={{ zIndex: valueMin > (min + max) / 2 ? 5 : 3 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => setHi(e.target.value)}
          aria-label="حداکثر قیمت"
          className="price-range-input"
          style={{ zIndex: valueMax <= (min + max) / 2 ? 5 : 4 }}
        />
      </div>
    </div>
  )
}
