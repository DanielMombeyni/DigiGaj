import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Compass, HeartHandshake, Sparkles, Target } from 'lucide-react'
import { shopApi } from '@/services/api'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'

const FALLBACK = {
  eyebrow: 'درباره فروشگاه',
  title: `${brand.name}؛ انتخاب هوشمند گجت`,
  subtitle: 'فروشگاه تخصصی گجت با تمرکز روی اصالت، شفافیت و پشتیبانی واقعی.',
  story: `${brand.name} برای خرید مطمئن گجت ساخته شده است.`,
  mission_title: 'ماموریت ما',
  mission: 'خرید گجت شفاف، سریع و قابل‌اعتماد.',
  vision_title: 'چشم‌انداز',
  vision: 'مرجع قابل‌اعتماد خرید گجت.',
  stats: [],
  values: [],
  highlights: [],
  team_title: 'چرا به ما اعتماد کنید؟',
  team_body: '',
  cta_label: 'مشاهده محصولات',
  cta_href: '/products',
  secondary_cta_label: 'تماس با پشتیبانی',
  secondary_cta_href: '/contact',
}

const VALUE_ICONS = [Sparkles, Target, HeartHandshake, Compass]

export default function AboutPage() {
  const [content, setContent] = useState(FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shopApi
      .infoPage('about')
      .then((r) => setContent({ ...FALLBACK, ...(r.data?.content || {}) }))
      .catch(() => setContent(FALLBACK))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Seo
        title={content.title || 'درباره ما'}
        description={(content.subtitle || content.story || '').slice(0, 160)}
        path="/about"
      />

      <section className="relative overflow-hidden bg-hero-mesh px-4 py-16 text-white md:py-24">
        <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-copper-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-10 h-40 w-40 rounded-full bg-sea-500/20 blur-3xl" />
        <Reveal className="relative mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.22em] text-copper-400">{content.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight md:text-6xl">
            {content.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/65 md:text-lg">{content.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={content.cta_href || '/products'} className="btn-primary inline-flex cursor-pointer">
              {content.cta_label || 'مشاهده محصولات'}
            </Link>
            <Link
              to={content.secondary_cta_href || '/contact'}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              {content.secondary_cta_label || 'تماس'}
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </Reveal>
      </section>

      {!!content.stats?.length && (
        <section className="border-b border-mist-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-px bg-mist-200 sm:grid-cols-2 lg:grid-cols-4">
            {content.stats.map((item) => (
              <div key={`${item.value}-${item.label}`} className="bg-white px-6 py-8 text-center">
                <p className="font-display text-2xl font-bold text-ink-950 md:text-3xl">{item.value}</p>
                <p className="mt-2 text-sm text-ink-700/55">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_0.8fr] md:py-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest text-copper-600">داستان ما</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-950">از علاقه به گجت تا فروشگاه قابل‌اعتماد</h2>
          <p className="mt-5 whitespace-pre-wrap text-base leading-9 text-ink-700/75">
            {loading ? 'در حال بارگذاری...' : content.story}
          </p>
        </Reveal>
        <Reveal className="space-y-4">
          <div className="rounded-3xl border border-mist-200 bg-gradient-to-br from-mist-50 to-white p-6 shadow-soft">
            <p className="text-xs font-semibold text-sea-600">{content.mission_title}</p>
            <p className="mt-3 text-sm leading-8 text-ink-700/75">{content.mission}</p>
          </div>
          <div className="rounded-3xl border border-mist-200 bg-ink-950 p-6 text-white shadow-soft">
            <p className="text-xs font-semibold text-copper-400">{content.vision_title}</p>
            <p className="mt-3 text-sm leading-8 text-white/70">{content.vision}</p>
          </div>
        </Reveal>
      </section>

      {!!content.values?.length && (
        <section className="bg-mist-50/80 px-4 py-14 md:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <p className="text-xs font-semibold tracking-widest text-copper-600">ارزش‌ها</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-ink-950">چیزی که خرید را متفاوت می‌کند</h2>
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {content.values.map((item, index) => {
                const Icon = VALUE_ICONS[index % VALUE_ICONS.length]
                return (
                  <Reveal key={item.title} className="rounded-3xl border border-mist-200 bg-white p-6 shadow-soft">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-copper-500/10 text-copper-600">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <h3 className="mt-4 font-display text-xl font-semibold text-ink-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-8 text-ink-700/65">{item.body}</p>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {!!content.highlights?.length && (
        <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <Reveal className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold tracking-widest text-copper-600">خدمات</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-ink-950">{content.team_title}</h2>
              <p className="mt-4 text-sm leading-8 text-ink-700/70">{content.team_body}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {content.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-mist-200 bg-white px-4 py-4 text-sm leading-7 text-ink-700/75 shadow-soft"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      )}

      <section className="px-4 pb-16 md:pb-24">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 overflow-hidden rounded-[2rem] bg-ink-950 px-6 py-10 text-white md:flex-row md:items-center md:px-10">
          <div>
            <p className="text-xs font-semibold tracking-widest text-copper-400">آماده خرید؟</p>
            <h2 className="mt-3 font-display text-3xl font-bold">گجت مناسب را امروز انتخاب کنید</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/55">
              از دسته‌بندی‌ها شروع کنید یا اگر سوال دارید، مستقیم با پشتیبانی حرف بزنید.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={content.cta_href || '/products'} className="btn-primary cursor-pointer">
              {content.cta_label || 'محصولات'}
            </Link>
            <Link
              to={content.secondary_cta_href || '/contact'}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-white/15 px-5 text-sm text-white/85 transition hover:bg-white/5"
            >
              {content.secondary_cta_label || 'تماس'}
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
