import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useCartStore } from '@/store/cart'
import { toman, faDigits } from '@/utils/format'

export default function CartPage() {
  const { items, setQty, remove, total } = useCartStore()

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">سبد خرید خالی است</h1>
        <Link to="/products" className="btn-dark mt-6 inline-flex">مشاهده محصولات</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">سبد خرید</h1>
      <ul className="mt-8 space-y-4">
        {items.map((item) => (
          <li
            key={`${item.product_id}:${item.variant_id || 0}`}
            className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-soft"
          >
            <div>
              <Link to={`/products/${item.slug}`} className="font-semibold hover:text-copper-600">
                {item.name}
              </Link>
              {item.variant_label && (
                <div className="mt-0.5 text-xs text-ink-700/50">{item.variant_label}</div>
              )}
              <div className="mt-1 text-sm text-copper-600">{toman(item.price_toman)}</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                className="input w-20"
                value={item.quantity}
                onChange={(e) => setQty(item.product_id, Number(e.target.value), item.variant_id)}
              />
              <button
                type="button"
                aria-label="حذف"
                onClick={() => remove(item.product_id, item.variant_id)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-center justify-between rounded-2xl bg-ink-950 px-5 py-4 text-white">
        <span>جمع: {toman(total())} ({faDigits(items.length)} قلم)</span>
        <Link to="/checkout" className="btn-primary">ادامه خرید</Link>
      </div>
    </div>
  )
}
