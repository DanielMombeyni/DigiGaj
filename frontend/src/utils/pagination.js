/**
 * Drain a DRF paginated list endpoint until all pages are loaded.
 * `request` should return an axios promise; params may include page_size.
 * Caps pages to avoid runaway loops.
 */
export async function fetchAllPages(request, params = {}, { pageSize = 100, maxPages = 50 } = {}) {
  const collected = []
  let page = 1
  let guard = 0

  while (guard < maxPages) {
    guard += 1
    const { data } = await request({ ...params, page, page_size: pageSize })
    const batch = Array.isArray(data) ? data : data?.results || []
    collected.push(...batch)

    const hasNext = Boolean(data?.next) || (typeof data?.count === 'number' && collected.length < data.count)
    if (!batch.length || !hasNext) break
    page += 1
  }

  return collected
}
