import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { shopApi } from '@/services/api'
import { useCartStore } from '@/store/cart'
import { toman } from '@/utils/format'
import { mediaSrc } from '@/utils/media'
import Seo, { productJsonLd } from '@/components/common/Seo'
import Reveal from '@/components/common/Reveal'
import ProductGridSection from '@/components/shop/ProductGridSection'
import BrandLogo from '@/components/common/BrandLogo'
import { brand } from '@/config/brand'
import { isPriceOnRequest } from '@/utils/pricing'
import PriceOnRequestNotice from '@/components/shop/PriceOnRequestNotice'

export default function ProductDetailPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(false)
  const [colorId, setColorId] = useState(null)
  const [sizeId, setSizeId] = useState(null)
  const [activeImage, setActiveImage] = useState(null)
  const add = useCartStore((s) => s.add)

  useEffect(() => {
    let cancelled = false
    setProduct(null)
    setError(false)
    setColorId(null)
    setSizeId(null)
    setActiveImage(null)
    shopApi
      .product(slug)
      .then((r) => {
        if (cancelled) return
        setProduct(r.data)
        const colors = r.data.colors || []
        const sizes = r.data.sizes || []
        if (colors[0]) setColorId(colors[0].id)
        if (sizes[0]) setSizeId(sizes[0].id)
        const img = r.data.primary_image || r.data.images?.[0]?.image
        setActiveImage(img || null)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const selectedVariant = useMemo(() => {
    if (!product) return null
    const variants = (product.variants || []).filter((v) => v.is_active !== false)
    if (!variants.length) return null
    return (
      variants.find(
        (v) =>
          (v.color || null) === (colorId || null) &&
          (v.size || null) === (sizeId || null),
      ) || null
    )
  }, [product, colorId, sizeId])

  const price = selectedVariant?.effective_price ?? product?.price_toman
  const onRequest = isPriceOnRequest(product)
  const stock = product?.has_options
    ? selectedVariant?.stock ?? 0
    : product?.stock ?? 0
  const canBuy = product?.has_options ? !!selectedVariant && stock > 0 : !!product?.in_stock

  const gallery = product?.images || []

  useEffect(() => {
    if (!product || !colorId) return
    const colorImg = gallery.find((img) => img.color === colorId)
    if (colorImg?.image) setActiveImage(colorImg.image)
  }, [colorId, product, gallery])

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <Seo title="محصول یافت نشد" noindex path={`/products/${slug}`} />
        <h1 className="font-display text-2xl font-bold">محصول یافت نشد</h1>
        <Link to="/products" className="btn-dark mt-6 inline-flex cursor-pointer">بازگشت به محصولات</Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-3xl bg-mist-100" />
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-mist-100" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-mist-100" />
          <div className="h-24 animate-pulse rounded bg-mist-100" />
        </div>
      </div>
    )
  }

  const image = activeImage || product.primary_image || product.images?.[0]?.image

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <Seo
        title={product.name}
        description={product.short_description || product.description || `خرید ${product.name} از ${brand.name}`}
        path={`/products/${product.slug}`}
        image={mediaSrc(image) || '/vite.svg'}
        type="product"
        jsonLd={productJsonLd(product)}
      />

      <div className="grid gap-10 md:grid-cols-2">
      <div>
        <Reveal className="overflow-hidden rounded-[2rem] border border-mist-200 bg-gradient-to-br from-ink-950 via-ink-900 to-sea-600/30 shadow-soft">
          <div className="aspect-square">
            {image ? (
              <img src={mediaSrc(image)} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/80">
                <span className="font-display text-5xl font-bold">{product.name.slice(0, 1)}</span>
                <BrandLogo size="sm" accentClass="text-white/40" restClass="text-white/40" />
              </div>
            )}
          </div>
        </Reveal>
        {gallery.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {gallery.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveImage(img.image)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                  activeImage === img.image ? 'border-copper-500' : 'border-mist-200'
                }`}
              >
                <img src={mediaSrc(img.image)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="animate-rise md:pt-4">
        <div className="text-sm font-medium text-sea-600">{product.category_name}</div>
        <h1 className="mt-2 font-display text-3xl font-bold leading-snug text-ink-900 md:text-4xl">
          {product.name}
        </h1>
        {product.brand && (
          <p className="mt-2 text-sm text-ink-700/50">برند: {product.brand}</p>
        )}
        <p className="mt-5 text-sm leading-8 text-ink-700/75">
          {product.short_description || product.description}
        </p>

        {(product.colors || []).length > 0 && (
          <div className="mt-8">
            <div className="label">رنگ</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorId(c.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    colorId === c.id
                      ? 'border-copper-500 bg-copper-500/5'
                      : 'border-mist-200 bg-white hover:border-copper-400/40'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-mist-200"
                    style={{ background: c.hex_code || '#ccc' }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {(product.sizes || []).length > 0 && (
          <div className="mt-6">
            <div className="label">سایز</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSizeId(s.id)}
                  className={`min-w-12 rounded-xl border px-3 py-2 text-sm transition ${
                    sizeId === s.id
                      ? 'border-copper-500 bg-copper-500/5 font-semibold'
                      : 'border-mist-200 bg-white hover:border-copper-400/40'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          {onRequest ? (
            <PriceOnRequestNotice variant="detail" />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="font-display text-3xl font-bold text-copper-600">
                  {toman(price)}
                </div>
                {product.compare_at_price_toman > price && (
                  <>
                    <div className="pb-1 text-sm text-ink-700/40 line-through">
                      {toman(product.compare_at_price_toman)}
                    </div>
                    <span className="mb-1 rounded-lg bg-copper-500 px-2 py-1 text-xs font-bold text-white">
                      ٪
                      {Math.round(
                        (1 - price / product.compare_at_price_toman) * 100,
                      )}
                      -
                    </span>
                  </>
                )}
              </div>
              {product.has_options && (
                <p className="mt-2 text-xs text-ink-700/45">
                  {selectedVariant
                    ? `موجودی این تنوع: ${stock}`
                    : 'این ترکیب موجود نیست'}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary min-h-11 cursor-pointer px-8"
                  disabled={!canBuy}
                  onClick={() =>
                    add(product, 1, {
                      variant_id: selectedVariant?.id || null,
                      variant_label: selectedVariant?.label || '',
                      price_toman: price,
                    })
                  }
                >
                  {canBuy ? 'افزودن به سبد' : 'ناموجود'}
                </button>
              </div>
            </>
          )}
        </div>

        {(product.attributes || []).length > 0 && (
          <dl className="mt-12 space-y-1 rounded-2xl border border-mist-200 bg-white p-5 text-sm shadow-soft">
            <div className="mb-3 font-semibold text-ink-900">ویژگی‌ها</div>
            {product.attributes.map((a) => (
              <div key={a.id || a.name} className="flex justify-between gap-4 border-b border-mist-100 py-2.5 last:border-0">
                <dt className="text-ink-700/50">{a.name}</dt>
                <dd className="font-medium text-ink-900">{a.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {product.specs && Object.keys(product.specs).length > 0 && !(product.attributes || []).length && (
          <dl className="mt-12 space-y-1 rounded-2xl border border-mist-200 bg-white p-5 text-sm shadow-soft">
            <div className="mb-3 font-semibold text-ink-900">مشخصات</div>
            {Object.entries(product.specs).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-mist-100 py-2.5 last:border-0">
                <dt className="text-ink-700/50">{k}</dt>
                <dd className="font-medium text-ink-900">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      </div>

      <ProductGridSection
        eyebrow="SIMILAR"
        title="محصولات مشابه"
        subtitle={`دیگر محصولات دسته ${product.category_name || 'این محصول'}`}
        products={product.similar_products}
        linkTo={`/products?category=${product.category}`}
        linkLabel="همه محصولات این دسته"
      />

      <ProductGridSection
        eyebrow="RECOMMENDED"
        title="پیشنهاد ما"
        subtitle={`منتخب‌های ویژه ${brand.name} که ممکن است دوست داشته باشید`}
        products={product.recommended_products}
        linkTo="/products?is_featured=true"
        linkLabel="همه پیشنهادها"
      />
    </div>
  )
}
