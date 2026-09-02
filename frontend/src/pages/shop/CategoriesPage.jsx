import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '@/services/api'
import { mediaSrc } from '@/utils/media'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'

export default function CategoriesPage() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shopApi
      .categories()
      .then((r) => setCats(r.data.results || r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <Seo
        title="دسته‌بندی‌ها"
        description={`مرور دسته‌بندی‌های ${brand.name} — هدفون، ساعت هوشمند، لوازم موبایل و گیمینگ`}
        path="/categories"
      />
      <Reveal>
        <p className="text-xs font-semibold tracking-widest text-copper-600">CATEGORIES</p>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">دسته‌بندی‌ها</h1>
        <p className="mt-2 text-sm text-ink-700/60">انتخاب مسیر خرید بر اساس نیاز شما</p>
      </Reveal>
      {loading ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-mist-100" />
          ))}
        </div>
      ) : (
        <Reveal className="reveal-scope mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c, i) => (
            <Link
              key={c.id}
              to={`/products?category=${c.id}`}
              className="reveal group relative overflow-hidden rounded-2xl border border-mist-200 bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:border-copper-400/30"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="aspect-[16/10] overflow-hidden bg-mist-50">
                {c.image ? (
                  <img
                    src={mediaSrc(c.image)}
                    alt={c.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mist-100 to-sea-500/10">
                    <span className="font-display text-3xl font-bold text-ink-900/15">{c.name?.slice(0, 1)}</span>
                  </div>
                )}
              </div>
              <div className="relative p-5">
                <div className="font-display text-xl font-bold text-ink-900 group-hover:text-copper-600">
                  {c.name}
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-7 text-ink-700/60">
                  {c.description || 'مشاهده محصولات این دسته'}
                </p>
                <span className="mt-4 inline-block text-xs font-semibold text-sea-600">مشاهده ←</span>
              </div>
            </Link>
          ))}
        </Reveal>
      )}
    </div>
  )
}
