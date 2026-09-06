import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { toman } from '@/utils/format'
import { mediaSrc } from '@/utils/media'
import { useCartStore } from '@/store/cart'
import BrandLogo from '@/components/common/BrandLogo'
import { isPriceOnRequest } from '@/utils/pricing'
import PriceOnRequestNotice from '@/components/shop/PriceOnRequestNotice'

export function ProductCard({ product }) {
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
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-mist-200/80 bg-white shadow-soft transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(15,23,42,0.14)]"
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
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center sm:p-6">
            <span className="font-display text-2xl font-bold text-white/90 sm:text-3xl">
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
          <span className="absolute right-2 top-2 rounded-lg bg-copper-500 px-1.5 py-0.5 text-[10px] font-bold text-white sm:right-3 sm:top-3 sm:px-2 sm:py-1 sm:text-xs">
            ٪{discount}-
          </span>
        )}
        {product.is_featured && (
          <span className="absolute left-2 top-2 rounded-lg bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur sm:left-3 sm:top-3 sm:px-2 sm:py-1 sm:text-[11px]">
            ویژه
          </span>
        )}
        {onRequest && (
          <span className="absolute bottom-2 right-2 rounded-lg bg-ink-950/75 px-1.5 py-0.5 text-[9px] font-semibold text-copper-400 backdrop-blur sm:bottom-3 sm:right-3 sm:px-2 sm:py-1 sm:text-[10px]">
            قیمت با تماس
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <div className="truncate text-[10px] font-medium tracking-wide text-sea-600 sm:text-[11px]">
          {product.category_name || product.brand || 'گجت'}
        </div>
        <Link to={`/products/${product.slug}`}>
          <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-bold leading-6 text-ink-900 transition group-hover:text-copper-600 sm:mt-1 sm:text-base sm:leading-7">
            {product.name}
          </h3>
        </Link>
        {product.short_description && (
          <p className="mt-1 hidden line-clamp-2 text-xs leading-6 text-ink-700/55 sm:block">
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

        <div className="mt-auto pt-2.5 sm:pt-4">
          {onRequest ? (
            <PriceOnRequestNotice variant="card" />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-copper-600 sm:text-sm">
                  {product.has_options &&
                  product.min_price != null &&
                  product.min_price !== product.price_toman
                    ? `از ${toman(displayPrice)}`
                    : toman(displayPrice)}
                </div>
                {discount > 0 && (
                  <div className="text-[10px] text-ink-700/35 line-through sm:text-xs">
                    {toman(product.compare_at_price_toman)}
                  </div>
                )}
              </div>
              {product.has_options ? (
                <Link
                  to={`/products/${product.slug}`}
                  className="cursor-pointer rounded-lg bg-ink-950 px-2.5 py-1.5 text-center text-[11px] font-semibold text-white transition hover:bg-copper-500 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
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
                  className="cursor-pointer rounded-lg bg-ink-950 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-copper-500 disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
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
