import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { categoryChildrenMap } from '@/utils/categories'
import { cn } from '@/utils/format'

/**
 * Expandable parent/child category picker for the products filter panel.
 * Selecting a node uses the existing API `category` param (includes descendants).
 */
export default function CategoryFilterTree({ categories = [], value, onChange }) {
  const childrenOf = useMemo(() => categoryChildrenMap(categories), [categories])
  const roots = childrenOf.get('root') || []
  const [openIds, setOpenIds] = useState(() => new Set())

  // Auto-expand ancestors of the selected category so the active leaf stays visible.
  useEffect(() => {
    if (!value || !categories.length) return
    const byId = new Map(categories.map((c) => [String(c.id), c]))
    const next = new Set()
    let cur = byId.get(String(value))
    while (cur?.parent != null) {
      next.add(String(cur.parent))
      cur = byId.get(String(cur.parent))
    }
    if (next.size) setOpenIds((prev) => new Set([...prev, ...next]))
  }, [value, categories])

  const toggleOpen = (id) => {
    const key = String(id)
    setOpenIds((prev) => {
      const copy = new Set(prev)
      if (copy.has(key)) copy.delete(key)
      else copy.add(key)
      return copy
    })
  }

  const renderNode = (cat, depth) => {
    const id = String(cat.id)
    const kids = childrenOf.get(id) || []
    const hasKids = kids.length > 0
    const selected = String(value) === id
    const open = openIds.has(id)

    return (
      <div key={id} className="min-w-0">
        <div
          className={cn(
            'flex min-h-11 items-stretch gap-0.5 rounded-xl transition',
            selected ? 'bg-copper-500/10' : 'hover:bg-mist-50',
          )}
          style={depth ? { paddingInlineStart: `${Math.min(depth, 4) * 0.65}rem` } : undefined}
        >
          {hasKids ? (
            <button
              type="button"
              className="inline-flex w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-700/45 outline-none transition hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-copper-400"
              aria-expanded={open}
              aria-label={open ? 'بستن زیردسته‌ها' : 'باز کردن زیردسته‌ها'}
              onClick={() => toggleOpen(id)}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition duration-200 motion-reduce:transition-none',
                  open && 'rotate-180',
                )}
                strokeWidth={2}
                aria-hidden
              />
            </button>
          ) : (
            <span className="w-9 shrink-0" aria-hidden />
          )}
          <button
            type="button"
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 px-2 py-2.5 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper-400',
              selected ? 'font-semibold text-copper-600' : 'font-medium text-ink-900',
            )}
            aria-pressed={selected}
            onClick={() => onChange(id)}
          >
            <span className="min-w-0 truncate">{cat.name}</span>
            {selected && <Check className="h-4 w-4 shrink-0 text-copper-500" strokeWidth={2} aria-hidden />}
          </button>
        </div>
        {hasKids && (
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-0.5 pb-1 pt-0.5">{kids.map((child) => renderNode(child, depth + 1))}</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-0.5" aria-label="دسته‌بندی">
      <button
        type="button"
        aria-pressed={!value}
        className={cn(
          'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-copper-400',
          !value
            ? 'bg-copper-500/10 font-semibold text-copper-600'
            : 'font-medium text-ink-900 hover:bg-mist-50',
        )}
        onClick={() => onChange('')}
      >
        <span>همه دسته‌ها</span>
        {!value && <Check className="h-4 w-4 shrink-0 text-copper-500" strokeWidth={2} aria-hidden />}
      </button>
      {roots.map((cat) => renderNode(cat, 0))}
    </div>
  )
}
