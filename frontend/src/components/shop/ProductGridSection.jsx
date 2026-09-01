import { Link } from 'react-router-dom'
import Reveal from '@/components/common/Reveal'
import { ProductCard } from '@/components/shop/ProductCard'

export default function ProductGridSection({
  eyebrow,
  title,
  subtitle,
  products,
  linkTo,
  linkLabel = 'مشاهده همه',
}) {
  if (!products?.length) return null

  return (
    <section className="mt-16 md:mt-20">
      <Reveal className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold tracking-widest text-copper-600">{eyebrow}</p>
          )}
          <h2 className="mt-2 font-display text-2xl font-bold text-ink-900 md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-ink-700/60">{subtitle}</p>}
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className="cursor-pointer text-sm font-semibold text-sea-600 transition hover:text-copper-600"
          >
            {linkLabel} ←
          </Link>
        )}
      </Reveal>
      <Reveal className="reveal-scope grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </Reveal>
    </section>
  )
}
