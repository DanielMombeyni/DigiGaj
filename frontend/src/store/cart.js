import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function lineKey(productId, variantId) {
  return `${productId}:${variantId || 0}`
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      add(product, quantity = 1, opts = {}) {
        const variantId = opts.variant_id || null
        const key = lineKey(product.id, variantId)
        const items = [...get().items]
        const idx = items.findIndex((i) => lineKey(i.product_id, i.variant_id) === key)
        if (idx >= 0) {
          items[idx].quantity += quantity
        } else {
          items.push({
            product_id: product.id,
            variant_id: variantId,
            name: product.name,
            variant_label: opts.variant_label || '',
            price_toman: opts.price_toman ?? product.price_toman,
            slug: product.slug,
            primary_image: product.primary_image || null,
            quantity,
          })
        }
        set({ items })
      },
      remove(productId, variantId = null) {
        const key = lineKey(productId, variantId)
        set({
          items: get().items.filter((i) => lineKey(i.product_id, i.variant_id) !== key),
        })
      },
      setQty(productId, quantity, variantId = null) {
        const key = lineKey(productId, variantId)
        set({
          items: get().items.map((i) =>
            lineKey(i.product_id, i.variant_id) === key
              ? { ...i, quantity: Math.max(1, quantity) }
              : i,
          ),
        })
      },
      clear() {
        set({ items: [] })
      },
      total() {
        return get().items.reduce((s, i) => s + i.price_toman * i.quantity, 0)
      },
    }),
    { name: 'gadget-cart-v2' },
  ),
)
