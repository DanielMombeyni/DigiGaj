import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { shopApi } from '@/services/api'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'

export default function AboutPage() {
  const { slug } = useParams()
  const pageSlug = slug || 'about'
  const [page, setPage] = useState(null)

  useEffect(() => {
    shopApi
      .page(pageSlug)
      .then((r) => setPage(r.data))
      .catch(() =>
        setPage({
          title: pageSlug === 'about' ? 'درباره ما' : pageSlug,
          body:
            pageSlug === 'about'
              ? `${brand.name} فروشگاه تخصصی گجت و لوازم دیجیتال است؛ با تمرکز روی اصالت کالا، تجربه خرید شفاف و پشتیبانی واقعی.`
              : 'محتوای این صفحه به‌زودی تکمیل می‌شود.',
        }),
      )
  }, [pageSlug])

  return (
    <div>
      <Seo
        title={page?.title || 'درباره ما'}
        description={(page?.body || '').slice(0, 160)}
        path={slug ? `/pages/${slug}` : '/about'}
      />
      <section className="bg-hero-mesh px-4 py-16 text-white md:py-20">
        <Reveal className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-widest text-copper-400">ABOUT</p>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">
            {page?.title || 'درباره ما'}
          </h1>
        </Reveal>
      </section>
      <Reveal className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="whitespace-pre-wrap text-base leading-9 text-ink-700/80">
          {page?.body}
        </p>
        <Link to="/products" className="btn-dark mt-10 inline-flex cursor-pointer">
          مشاهده محصولات
        </Link>
      </Reveal>
    </div>
  )
}
