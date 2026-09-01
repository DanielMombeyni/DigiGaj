import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Custom select — avoids native <select> overflow bugs on mobile RTL.
 */
export default function FilterSelect({ label, value, onChange, options = [], id }) {
  const autoId = useId()
  const listId = id || autoId
  const rootRef = useRef(null)
  const sheetRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  )

  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Desktop only — portal sheet is NOT inside rootRef
  useEffect(() => {
    if (!open || isMobile) return undefined
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isMobile])

  useEffect(() => {
    if (!open || !isMobile) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, isMobile])

  const pick = (next) => {
    onChange(next)
    setOpen(false)
  }

  const triggerId = `${listId}-trigger`
  const menuId = `${listId}-menu`

  const optionList = (
    <ul
      id={menuId}
      role="listbox"
      aria-label={label}
      className="max-h-[min(60vh,16rem)] overflow-y-auto overscroll-contain py-1"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <li key={opt.value || '__empty'} role="none">
            <button
              type="button"
              role="option"
              aria-selected={active}
              className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-sm transition sm:py-2.5 ${
                active
                  ? 'bg-copper-500/10 font-semibold text-copper-600'
                  : 'text-ink-900 hover:bg-mist-50 active:bg-mist-100'
              }`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                pick(opt.value)
              }}
            >
              <span className="min-w-0 truncate">{opt.label}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-copper-500" strokeWidth={2} />}
            </button>
          </li>
        )
      })}
    </ul>
  )

  const mobileSheet =
    open && isMobile
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] touch-none"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute inset-0 bg-ink-950/50 touch-auto"
              aria-label="بستن"
              onClick={() => setOpen(false)}
            />
            <div
              ref={sheetRef}
              className="absolute inset-x-0 bottom-0 z-[201] max-h-[75vh] touch-auto overflow-hidden rounded-t-2xl border-t border-mist-200 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.2)] animate-rise"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
                <span className="font-semibold text-ink-900">{label}</span>
                <button
                  type="button"
                  className="cursor-pointer text-sm font-medium text-sea-600"
                  onClick={() => setOpen(false)}
                >
                  بستن
                </button>
              </div>
              {optionList}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div ref={rootRef} className="relative min-w-0 max-w-full">
        <span className="label" id={`${listId}-label`}>
          {label}
        </span>
        <button
          type="button"
          id={triggerId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-labelledby={`${listId}-label`}
          className="select-field flex w-full min-w-0 items-center justify-between gap-2 text-start"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? '—'}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-ink-700/40 transition ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.75}
            aria-hidden
          />
        </button>

        {open && !isMobile && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-mist-200 bg-white shadow-soft">
            {optionList}
          </div>
        )}
      </div>
      {mobileSheet}
    </>
  )
}
