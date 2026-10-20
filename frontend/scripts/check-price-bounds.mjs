/**
 * DB-free smoke checks for category price-bound helpers (mirrors ProductsPage).
 * Run: node scripts/check-price-bounds.mjs
 */

const PRICE_STEP = 100_000

function roundUp(n, step = PRICE_STEP) {
  return Math.ceil(n / step) * step
}

function roundDown(n, step = PRICE_STEP) {
  return Math.floor(n / step) * step
}

function boundsFromStats(rawMin, rawMax) {
  const minN = Number(rawMin)
  const maxN = Number(rawMax)
  if (!Number.isFinite(minN) || !Number.isFinite(maxN) || minN <= 0 || maxN <= 0) {
    return { floor: 0, ceil: 0, mode: 'none' }
  }
  if (minN === maxN) {
    return { floor: minN, ceil: maxN, mode: 'single' }
  }
  let floor = roundDown(minN)
  let ceil = roundUp(maxN)
  if (ceil <= floor) {
    return { floor: minN, ceil: maxN, mode: 'single' }
  }
  if (ceil - floor < PRICE_STEP) {
    return { floor: minN, ceil: maxN, mode: 'single' }
  }
  return { floor, ceil, mode: 'range' }
}

function clampPrice(n, floor, ceil) {
  if (!Number.isFinite(n)) return floor
  return Math.min(ceil, Math.max(floor, n))
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(boundsFromStats(null, null).mode === 'none', 'null → none')
assert(boundsFromStats(500_000, 500_000).mode === 'single', 'equal → single')
assert(boundsFromStats(1_250_000, 3_100_000).floor === 1_200_000, 'round down floor')
assert(boundsFromStats(1_250_000, 3_100_000).ceil === 3_100_000, 'exact step ceil unchanged')
assert(boundsFromStats(1_250_000, 3_150_000).ceil === 3_200_000, 'round up ceil')
assert(boundsFromStats(1_250_000, 3_100_000).mode === 'range', 'span → range')

const b = boundsFromStats(1_000_000, 5_000_000)
assert(clampPrice(500_000, b.floor, b.ceil) === b.floor, 'clamp low')
assert(clampPrice(9_000_000, b.floor, b.ceil) === b.ceil, 'clamp high')
assert(clampPrice(2_000_000, b.floor, b.ceil) === 2_000_000, 'clamp mid')

console.log('check-price-bounds: OK')
