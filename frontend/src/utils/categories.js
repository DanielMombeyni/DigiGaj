/** Build indented category options for selects (parent → children). */
export function categorySelectOptions(items, { includeRootLabel = false } = {}) {
  const list = Array.isArray(items) ? items : []
  const byParent = new Map()
  for (const c of list) {
    const key = c.parent == null ? 'root' : String(c.parent)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  for (const group of byParent.values()) {
    group.sort((a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(b.name, 'fa'))
  }
  const out = []
  const walk = (parentKey, depth) => {
    for (const c of byParent.get(parentKey) || []) {
      const prefix = depth > 0 ? `${'—'.repeat(depth)} ` : ''
      out.push({
        value: String(c.id),
        label: `${prefix}${c.name}`,
        id: c.id,
        depth,
      })
      walk(String(c.id), depth + 1)
    }
  }
  walk('root', 0)
  const seen = new Set(out.map((o) => o.id))
  for (const c of list) {
    if (!seen.has(c.id)) {
      out.push({ value: String(c.id), label: c.name, id: c.id, depth: 0 })
    }
  }
  if (includeRootLabel) {
    return [{ value: '', label: 'همه دسته‌ها' }, ...out]
  }
  return out
}
