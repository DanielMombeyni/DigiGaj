import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Shared admin dialog for create/edit forms.
 * Focuses the first field once when opened; closes on Escape / backdrop click.
 */
export default function AdminModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
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
      const el = panel.querySelector(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([data-modal-close]):not([disabled])',
      )
      el?.focus?.()
    }, 30)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open])

  if (!open) return null

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  const handleClose = () => onClose?.()

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px] transition animate-rise"
        onClick={onClose}
        data-modal-close
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-[81] flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-mist-200 bg-surface shadow-[0_24px_64px_rgba(15,23,42,0.28)] animate-rise sm:rounded-3xl ${widths[size] || widths.md}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-mist-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-bold text-ink-900 sm:text-xl">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-ink-700/50">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-mist-50 text-ink-700/60 transition hover:bg-mist-100 hover:text-ink-900"
            aria-label="بستن"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        ) : null}

        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-mist-100 bg-mist-50/60 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ModalCancelButton({ onClick, children = 'انصراف', disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary min-h-10 cursor-pointer px-4 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function ModalSubmitButton({ loading, children, disabled, form, type = 'submit', onClick }) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      className="btn-primary min-h-10 cursor-pointer px-5 disabled:cursor-wait disabled:opacity-60"
      disabled={disabled || loading}
    >
      {loading ? 'در حال ذخیره...' : children}
    </button>
  )
}

export function ModalDangerButton({ onClick, loading, children = 'حذف', disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="min-h-10 cursor-pointer rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
    >
      {loading ? '...' : children}
    </button>
  )
}
