import { Children } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

export function AdminPageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-700/55">{description}</p>}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function AdminStatCard({ label, value, hint, accent = 'copper' }) {
  const accents = {
    copper: 'from-copper-500/15 to-transparent text-copper-600',
    sea: 'from-sea-500/15 to-transparent text-sea-600',
    ink: 'from-ink-900/10 to-transparent text-ink-900',
    emerald: 'from-emerald-500/15 to-transparent text-emerald-700',
    amber: 'from-amber-500/15 to-transparent text-amber-700',
  }
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-mist-200/80 bg-surface p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,23,42,0.1)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-bl ${accents[accent] || accents.copper}`} />
      <div className="relative">
        <div className="text-xs font-medium text-ink-700/50">{label}</div>
        <div className="mt-2 font-display text-2xl font-bold text-ink-900">{value ?? '—'}</div>
        {hint && <div className="mt-2 text-[11px] text-ink-700/40">{hint}</div>}
      </div>
    </div>
  )
}

export function AdminCard({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-mist-200/80 bg-surface p-5 shadow-soft ${className}`}>
      {title && <h2 className="mb-4 font-semibold text-ink-900">{title}</h2>}
      {children}
    </section>
  )
}

export function AdminTable({
  columns,
  children,
  emptyMessage = 'هیچ داده‌ای وجود ندارد',
}) {
  const rows = Children.toArray(children).filter(Boolean)
  const isEmpty = rows.length === 0

  return (
    <div className="overflow-x-auto rounded-2xl border border-mist-200/80 bg-surface shadow-soft">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-mist-50 text-right text-ink-700/60">
          <tr>
            {columns.map((c) => (
              <th key={c || 'actions'} className="px-4 py-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td
                colSpan={Math.max(columns.length, 1)}
                className="px-4 py-12 text-center text-sm text-ink-700/45"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  )
}

export function AdminEditButton({ onClick, label = 'ویرایش' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-sea-600 transition hover:bg-sea-500/10 hover:text-copper-600"
    >
      <Pencil className="h-4 w-4" strokeWidth={1.85} />
    </button>
  )
}

export function AdminDeleteButton({ onClick, label = 'حذف' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 className="h-4 w-4" strokeWidth={1.85} />
    </button>
  )
}
