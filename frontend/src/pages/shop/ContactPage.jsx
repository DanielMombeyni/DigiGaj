import { useEffect, useState } from 'react'
import { Clock3, Headphones, Mail, MapPin, MessageSquareText, Phone, ShieldCheck } from 'lucide-react'
import { shopApi } from '@/services/api'
import Seo, { organizationJsonLd } from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { getStorefrontConfig } from '@/services/storefrontConfig'

const FALLBACK = {
  eyebrow: 'پشتیبانی',
  title: `تماس با ${brand.name}`,
  subtitle: 'از فرم یا کانال‌های زیر با ما در ارتباط باشید.',
  intro: 'فرم زیر تیکت پشتیبانی می‌سازد تا پیام‌تان گم نشود.',
  form_title: 'ارسال پیام به پشتیبانی',
  form_hint: 'پس از ثبت، شماره تیکت دریافت می‌کنید.',
  hours_title: 'ساعات پاسخ‌گویی',
  hours: [],
  channels: [],
  faqs: [],
  map_note: '',
  promise_title: 'قول ما در پشتیبانی',
  promise_body: '',
}

const CHANNEL_ICONS = [MessageSquareText, Headphones, ShieldCheck]

export default function ContactPage() {
  const [content, setContent] = useState(FALLBACK)
  const [config, setConfig] = useState(null)
  const [sent, setSent] = useState(false)
  const [ticketNo, setTicketNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })

  useEffect(() => {
    shopApi
      .infoPage('contact')
      .then((r) => setContent({ ...FALLBACK, ...(r.data?.content || {}) }))
      .catch(() => setContent(FALLBACK))
    getStorefrontConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await shopApi.createTicket({
        full_name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim() || 'پیام از صفحه تماس',
        message: form.message.trim(),
      })
      setTicketNo(data.ticket_number || '')
      setSent(true)
    } catch (err) {
      const d = err.response?.data
      setError(
        typeof d === 'object'
          ? d.detail || d.non_field_errors?.[0] || Object.values(d).flat?.()?.[0] || 'ارسال ناموفق بود'
          : 'ارسال ناموفق بود',
      )
    } finally {
      setLoading(false)
    }
  }

  const companyPhone = config?.company_phone
  const companyEmail = config?.company_email
  const companyAddress = config?.company_address

  return (
    <div>
      <Seo
        title={content.title || 'تماس با ما'}
        description={content.subtitle || `پشتیبانی ${brand.name}`}
        path="/contact"
        jsonLd={organizationJsonLd({
          email: companyEmail,
          phone: companyPhone,
          address: companyAddress,
        })}
      />

      <section className="relative overflow-hidden bg-hero-mesh px-4 py-16 text-white md:py-20">
        <div className="pointer-events-none absolute -right-10 top-8 h-48 w-48 rounded-full bg-copper-400/25 blur-3xl" />
        <Reveal className="relative mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.22em] text-copper-400">{content.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">{content.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/65">{content.subtitle}</p>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-white/50">{content.intro}</p>
        </Reveal>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:py-16">
        <div className="space-y-4">
          <Reveal className="rounded-3xl border border-mist-200 bg-white p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold text-ink-950">راه‌های ارتباطی</h2>
            <ul className="mt-5 space-y-4 text-sm text-ink-700/80">
              {companyPhone && (
                <li>
                  <a href={`tel:${companyPhone}`} className="flex items-start gap-3 transition hover:text-copper-600">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-copper-500" strokeWidth={1.75} />
                    <span>
                      <span className="block text-xs text-ink-700/45">تلفن</span>
                      {companyPhone}
                    </span>
                  </a>
                </li>
              )}
              {companyEmail && (
                <li>
                  <a href={`mailto:${companyEmail}`} className="flex items-start gap-3 transition hover:text-copper-600">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-copper-500" strokeWidth={1.75} />
                    <span className="min-w-0">
                      <span className="block text-xs text-ink-700/45">ایمیل</span>
                      <span className="break-all" dir="ltr">
                        {companyEmail}
                      </span>
                    </span>
                  </a>
                </li>
              )}
              {companyAddress && (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-copper-500" strokeWidth={1.75} />
                  <span>
                    <span className="block text-xs text-ink-700/45">آدرس</span>
                    <span className="leading-7">{companyAddress}</span>
                  </span>
                </li>
              )}
              {!companyPhone && !companyEmail && !companyAddress && (
                <li className="text-ink-700/55">اطلاعات تماس فروشگاه به‌زودی در تنظیمات تکمیل می‌شود.</li>
              )}
            </ul>
            {content.map_note && <p className="mt-5 text-xs leading-7 text-ink-700/45">{content.map_note}</p>}
          </Reveal>

          {!!content.hours?.length && (
            <Reveal className="rounded-3xl border border-mist-200 bg-mist-50/70 p-6">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-sea-600" strokeWidth={1.8} />
                <h3 className="font-semibold text-ink-950">{content.hours_title}</h3>
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                {content.hours.map((row) => (
                  <li key={`${row.days}-${row.time}`} className="flex items-center justify-between gap-3 border-b border-mist-200/80 pb-3 last:border-0">
                    <span className="text-ink-700/70">{row.days}</span>
                    <span className="font-medium text-ink-950">{row.time}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {!!content.channels?.length && (
            <div className="grid gap-3">
              {content.channels.map((item, index) => {
                const Icon = CHANNEL_ICONS[index % CHANNEL_ICONS.length]
                return (
                  <Reveal key={item.title} className="rounded-3xl border border-mist-200 bg-white p-5 shadow-soft">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-500/10 text-copper-600">
                        <Icon className="h-4.5 w-4" strokeWidth={1.8} />
                      </span>
                      <div>
                        <h3 className="font-semibold text-ink-950">{item.title}</h3>
                        <p className="mt-1 text-sm leading-7 text-ink-700/65">{item.body}</p>
                      </div>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          )}
        </div>

        <Reveal>
          {sent ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center text-sm text-emerald-800">
              <p>تیکت شما ثبت شد. به‌زودی پاسخ می‌دهیم.</p>
              {ticketNo && <p className="mt-3 font-mono text-base font-semibold tracking-wide">{ticketNo}</p>}
            </div>
          ) : (
            <form className="rounded-3xl border border-mist-200 bg-white p-6 shadow-soft md:p-8" onSubmit={submit}>
              <h2 className="font-display text-2xl font-semibold text-ink-950">{content.form_title}</h2>
              <p className="mt-2 text-sm leading-7 text-ink-700/55">{content.form_hint}</p>
              <div className="mt-6 grid gap-4">
                <label>
                  <span className="label">نام</span>
                  <input className="input" name="name" value={form.name} onChange={onChange} required autoComplete="name" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="label">ایمیل</span>
                    <input className="input" type="email" name="email" value={form.email} onChange={onChange} autoComplete="email" />
                  </label>
                  <label>
                    <span className="label">شماره تماس</span>
                    <input
                      className="input"
                      name="phone"
                      value={form.phone}
                      onChange={onChange}
                      autoComplete="tel"
                      placeholder="۰۹۱۲xxxxxxx"
                    />
                  </label>
                </div>
                <label>
                  <span className="label">موضوع</span>
                  <input className="input" name="subject" value={form.subject} onChange={onChange} required />
                </label>
                <label>
                  <span className="label">پیام</span>
                  <textarea className="input min-h-[150px]" name="message" value={form.message} onChange={onChange} required />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" className="btn-primary cursor-pointer" disabled={loading}>
                  {loading ? 'در حال ارسال...' : 'ثبت تیکت پشتیبانی'}
                </button>
              </div>
            </form>
          )}
        </Reveal>
      </section>

      {(content.promise_body || content.faqs?.length) && (
        <section className="bg-mist-50/70 px-4 py-14 md:py-20">
          <div className="mx-auto max-w-6xl space-y-8">
            {content.promise_body && (
              <Reveal className="rounded-[2rem] bg-ink-950 px-6 py-8 text-white md:px-10">
                <p className="text-xs font-semibold tracking-widest text-copper-400">{content.promise_title}</p>
                <p className="mt-3 max-w-3xl text-base leading-8 text-white/70">{content.promise_body}</p>
              </Reveal>
            )}
            {!!content.faqs?.length && (
              <div>
                <Reveal>
                  <p className="text-xs font-semibold tracking-widest text-copper-600">سوالات پرتکرار</p>
                  <h2 className="mt-3 font-display text-3xl font-bold text-ink-950">قبل از پیام، شاید جواب این‌جاست</h2>
                </Reveal>
                <div className="mt-6 grid gap-3">
                  {content.faqs.map((item) => (
                    <Reveal key={item.q} className="rounded-2xl border border-mist-200 bg-white px-5 py-4 shadow-soft">
                      <h3 className="font-semibold text-ink-950">{item.q}</h3>
                      <p className="mt-2 text-sm leading-8 text-ink-700/65">{item.a}</p>
                    </Reveal>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
