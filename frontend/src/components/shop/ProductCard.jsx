import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { toman } from '@/utils/format'
import { mediaSrc } from '@/utils/media'
import { useCartStore } from '@/store/cart'
import BrandLogo from '@/components/common/BrandLogo'
import { isPriceOnRequest } from '@/utils/pricing'
import PriceOnRequestNotice from '@/components/shop/PriceOnRequestNotice'

export function ProductCard({ product, index = 0 }) {
  const add = useCartStore((s) => s.add)
  const onRequest = isPriceOnRequest(product)
  const displayPrice = product.min_price ?? product.price_toman
  const discount =
    !onRequest &&
    product.compare_at_price_toman &&
    product.compare_at_price_toman > displayPrice
      ? Math.round((1 - displayPrice / product.compare_at_price_toman) * 100)
      : 0

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-mist-200/80 bg-white shadow-soft transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(15,23,42,0.14)] reveal"
      style={{ transitionDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link
        to={`/products/${product.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-sea-600/40"
      >
        {product.primary_image ? (
          <img
            src={mediaSrc(product.primary_image)}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="font-display text-3xl font-bold text-white/90">
              {product.name?.slice(0, 1)}
            </span>
            <BrandLogo size="xs" accentClass="text-white/50" restClass="text-white/50" />
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/50 via-transparent to-transparent opacity-80"
          aria-hidden
        />
        {discount > 0 && (
          <span className="absolute right-3 top-3 rounded-lg bg-copper-500 px-2 py-1 text-xs font-bold text-white">
            ٪{discount}-
          </span>
        )}
        {product.is_featured && (
          <span className="absolute left-3 top-3 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
            ویژه
          </span>
        )}
        {onRequest && (
          <span className="absolute bottom-3 right-3 rounded-lg bg-ink-950/75 px-2 py-1 text-[10px] font-semibold text-copper-400 backdrop-blur">
            قیمت با تماس
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-[11px] font-medium tracking-wide text-sea-600">
          {product.category_name || product.brand || 'گجت'}
        </div>
        <Link to={`/products/${product.slug}`}>
          <h3 className="mt-1 line-clamp-2 font-display text-base font-bold leading-7 text-ink-900 transition group-hover:text-copper-600">
            {product.name}
          </h3>
        </Link>
        {product.short_description && (
          <p className="mt-1 line-clamp-2 text-xs leading-6 text-ink-700/55">
            {product.short_description}
          </p>
        )}
        {Number(product.rating) > 0 && (
          <div className="mt-2 flex items-center gap-1" aria-label={`امتیاز ${product.rating} از ۵`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${
                  i <= Math.round(Number(product.rating))
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-mist-200'
                }`}
                strokeWidth={1.5}
              />
            ))}
            <span className="ms-1 text-[11px] text-ink-700/45">{product.rating}</span>
          </div>
        )}

        <div className="mt-auto pt-4">
          {onRequest ? (
            <PriceOnRequestNotice variant="card" />
          ) : (
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="font-bold text-copper-600">
                  {product.has_options &&
                  product.min_price != null &&
                  product.min_price !== product.price_toman
                    ? `از ${toman(displayPrice)}`
                    : toman(displayPrice)}
                </div>
                {discount > 0 && (
                  <div className="text-xs text-ink-700/35 line-through">
                    {toman(product.compare_at_price_toman)}
                  </div>
                )}
              </div>
              {product.has_options ? (
                <Link
                  to={`/products/${product.slug}`}
                  className="cursor-pointer rounded-xl bg-ink-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-copper-500"
                >
                  انتخاب
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={!product.in_stock}
                  onClick={(e) => {
                    e.preventDefault()
                    add(product, 1)
                  }}
                  className="cursor-pointer rounded-xl bg-ink-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-copper-500 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`افزودن ${product.name} به سبد`}
                >
                  {product.in_stock ? 'افزودن' : 'ناموجود'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
