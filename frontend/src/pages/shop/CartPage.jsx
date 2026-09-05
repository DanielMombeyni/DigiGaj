import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useCartStore } from '@/store/cart'
import { toman, faDigits } from '@/utils/format'
import { PRICE_ON_REQUEST_LABEL, isPriceOnRequest } from '@/utils/pricing'

export default function CartPage() {
  const { items, setQty, remove, total, hasPriceOnRequest } = useCartStore()

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">سبد خرید خالی است</h1>
        <Link to="/products" className="btn-dark mt-6 inline-flex">مشاهده محصولات</Link>
      </div>
    )
  }

  const por = hasPriceOnRequest() || items.some((i) => isPriceOnRequest(i))

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">سبد خرید</h1>
      {por && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
          برخی اقلام هنوز قیمت ثابت ندارند. با ثبت سفارش، تا اعلام قیمت توسط فروشگاه پرداخت انجام نمی‌شود.
        </p>
      )}
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
              <div className="mt-1 text-sm text-copper-600">
                {isPriceOnRequest(item) ? PRICE_ON_REQUEST_LABEL : toman(item.price_toman)}
              </div>
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
        <span>
          {por ? 'جمع اقلام قیمت‌دار: ' : 'جمع: '}
          {toman(total())} ({faDigits(items.length)} قلم)
        </span>
        <Link to="/checkout" className="btn-primary">ادامه خرید</Link>
      </div>
    </div>
  )
}
