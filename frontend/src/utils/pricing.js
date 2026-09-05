/** Shown instead of a fixed price when product has no catalog price */
export const PRICE_ON_REQUEST_LABEL = 'به دلیل نوسان قیمت با ما تماس بگیرید'

/**
 * True when the product/cart line should not show a toman amount.
 * Prefer explicit `price_on_request`; also treat numeric 0 as contact-for-price
 * (legacy rows that saved 0 without the flag).
 */
export function isPriceOnRequest(productOrItem) {
  if (!productOrItem) return false
  if (productOrItem.price_on_request === true) return true
  if (productOrItem.price_pending === true) return true
  const price = productOrItem.price_toman
  if (price === 0 || price === '0') return true
  return false
}

export function productPriceLabel(productOrItem, { prefix = '' } = {}) {
  if (isPriceOnRequest(productOrItem)) return PRICE_ON_REQUEST_LABEL
  const amount = productOrItem?.min_price ?? productOrItem?.price_toman
  if (amount == null) return PRICE_ON_REQUEST_LABEL
  return prefix ? `${prefix}${amount}` : amount
}
