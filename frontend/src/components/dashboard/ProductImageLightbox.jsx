import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { mediaSrc } from '@/utils/media'
import { faDigits } from '@/utils/format'

/**
 * Fullscreen product image gallery for admin list thumbnails.
 */
export default function ProductImageLightbox({
  open,
  onClose,
  title = '',
  images = [],
  startIndex = 0,
}) {
  const urls = useMemo(() => {
    const list = (images || [])
      .map((img) => (typeof img === 'string' ? img : img?.image))
      .filter(Boolean)
      .map((src) => mediaSrc(src))
    return list
  }, [images])

  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) return undefined
    setIndex(Math.min(Math.max(0, startIndex), Math.max(0, urls.length - 1)))
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') setIndex((i) => (urls.length ? (i + 1) % urls.length : 0))
      if (e.key === 'ArrowLeft')
        setIndex((i) => (urls.length ? (i - 1 + urls.length) % urls.length : 0))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, urls.length, startIndex])

  if (!open) return null

  const current = urls[index]
  const hasMany = urls.length > 1

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-ink-950/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `تصاویر ${title}` : 'گالری تصاویر'}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold sm:text-base">{title}</p>
          {urls.length > 0 && (
            <p className="mt-0.5 text-xs text-white/50">
              {faDigits(index + 1)} از {faDigits(urls.length)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
          aria-label="بستن"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="بستن گالری"
          onClick={onClose}
        />
        {current ? (
          <img
            src={current}
            alt=""
            className="relative z-10 max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="relative z-10 text-sm text-white/50">تصویری برای نمایش نیست</p>
        )}

        {hasMany && (
          <>
            <button
              type="button"
              className="absolute start-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 sm:start-6"
              aria-label="تصویر قبلی"
              onClick={(e) => {
                e.stopPropagation()
                setIndex((i) => (i - 1 + urls.length) % urls.length)
              }}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="absolute end-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 sm:end-6"
              aria-label="تصویر بعدی"
              onClick={(e) => {
                e.stopPropagation()
                setIndex((i) => (i + 1) % urls.length)
              }}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {hasMany && (
        <div className="relative z-10 flex gap-2 overflow-x-auto px-4 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {urls.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 ${
                i === index ? 'border-copper-400' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              aria-label={`تصویر ${i + 1}`}
              aria-current={i === index}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
