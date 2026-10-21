import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { cn, toman } from '@/utils/format'
import { mediaSrc } from '@/utils/media'
import { useCartStore } from '@/store/cart'
import BrandLogo from '@/components/common/BrandLogo'
import { isPriceOnRequest } from '@/utils/pricing'
import PriceOnRequestNotice from '@/components/shop/PriceOnRequestNotice'
import ProductCardSpecs from '@/components/shop/ProductCardSpecs'

/**
 * @param {'default' | 'home'} [density]
 *   `home` — compact mobile card for homepage featured grid (2-col);
 *   desktop/tablet (`sm+`) matches the default card look.
 */
export function ProductCard({ product, density = 'default' }) {
  const add = useCartStore((s) => s.add)
  const onRequest = isPriceOnRequest(product)
  const displayPrice = product.min_price ?? product.price_toman
  const home = density === 'home'
  const discount =
    !onRequest &&
    product.compare_at_price_toman &&
    product.compare_at_price_toman > displayPrice
      ? Math.round((1 - displayPrice / product.compare_at_price_toman) * 100)
      : 0

  return (
    <article
      className={cn(
        'group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-mist-200/80 bg-white shadow-soft transition duration-300',
        home
          ? 'hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)] sm:hover:-translate-y-1.5 sm:hover:shadow-[0_24px_50px_rgba(15,23,42,0.14)]'
          : 'hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(15,23,42,0.14)]',
      )}
    >
      <Link
        to={`/products/${product.slug}`}
        className={cn(
          'relative block overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-sea-600/40',
          home ? 'aspect-square sm:aspect-[4/3]' : 'aspect-[4/3]',
        )}
      >
        {product.primary_image ? (
          <img
            src={mediaSrc(product.primary_image)}
            alt={product.name}
            loading="lazy"
            className={cn(
              'h-full w-full transition duration-700 group-hover:scale-110',
              home ? 'object-contain p-1.5 sm:object-cover sm:p-0' : 'object-cover',
            )}
          />
        ) : (
          <div
            className={cn(
              'flex h-full flex-col items-center justify-center gap-2 text-center',
              home ? 'p-2 sm:p-6' : 'p-4 sm:p-6',
            )}
          >
            <span
              className={cn(
                'font-display font-bold text-white/90',
                home ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-3xl',
              )}
            >
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

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          home ? 'p-2 sm:p-4' : 'p-2.5 sm:p-4',
        )}
      >
        <div className="truncate text-[10px] font-medium tracking-wide text-sea-600 sm:text-[11px]">
          {product.category_name || product.brand || 'گجت'}
        </div>
        <Link to={`/products/${product.slug}`} className="min-w-0" title={product.name}>
          <h3
            className={cn(
              'line-clamp-2 min-w-0 font-display font-bold leading-5 text-ink-900 transition group-hover:text-copper-600 sm:leading-7',
              'mt-0.5 text-sm sm:mt-1 sm:text-base',
            )}
          >
            {product.name}
          </h3>
        </Link>
        <ProductCardSpecs specs={product.card_specs} dense={home} />
        {product.short_description && (
          <p className="mt-1 hidden line-clamp-2 text-xs leading-6 text-ink-700/55 sm:block">
            {product.short_description}
          </p>
        )}
        {Number(product.rating) > 0 && (
          <div
            className={cn('flex items-center gap-1', home ? 'mt-1.5 sm:mt-2' : 'mt-2')}
            aria-label={`امتیاز ${product.rating} از ۵`}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
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

        <div className={cn('mt-auto', home ? 'pt-2 sm:pt-4' : 'pt-2.5 sm:pt-4')}>
          {onRequest ? (
            <PriceOnRequestNotice variant="card" />
          ) : (
            <div className="min-w-0">
              <div
                className={cn(
                  'min-w-0 break-words font-bold text-copper-600',
                  home ? 'text-[11px] leading-4 sm:truncate sm:text-sm' : 'truncate text-xs sm:text-sm',
                )}
              >
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
          )}

          {/* Call-to-action — full-width dark button (default density) or compact inline (home). */}
          {onRequest ? (
            <ProductCardCta
              home={home}
              to={`/products/${product.slug}`}
              label="مشاهده محصول"
            />
          ) : product.has_options ? (
            <ProductCardCta home={home} to={`/products/${product.slug}`} label="انتخاب" />
          ) : product.in_stock ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                add(product, 1)
              }}
              className={cn(
                'w-full cursor-pointer rounded-xl bg-ink-950 font-semibold text-white transition hover:bg-copper-500',
                home
                  ? 'px-2 py-1.5 text-[10px] sm:px-3 sm:py-2 sm:text-xs'
                  : 'px-3 py-2.5 text-xs sm:py-2.5 sm:text-sm',
              )}
              aria-label={`افزودن ${product.name} به سبد`}
            >
              افزودن به سبد
            </button>
          ) : (
            <ProductCardCta home={home} to={`/products/${product.slug}`} label="مشاهده محصول" />
          )}
        </div>
      </div>
    </article>
  )
}

/** Full-width (default) / inline (home) dark button that navigates to the product. */
function ProductCardCta({ home, to, label }) {
  return (
    <Link
      to={to}
      className={cn(
        'block w-full cursor-pointer rounded-xl bg-ink-950 text-center font-semibold text-white transition hover:bg-copper-500',
        home
          ? 'px-2 py-1.5 text-[10px] sm:px-3 sm:py-2 sm:text-xs'
          : 'px-3 py-2.5 text-xs sm:py-2.5 sm:text-sm',
      )}
    >
      {label}
    </Link>
  )
}
