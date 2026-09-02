import { useEffect, useState } from 'react'
import { Mail, MapPin, Phone } from 'lucide-react'
import { shopApi } from '@/services/api'
import Seo, { organizationJsonLd } from '@/components/common/Seo'
import { brand } from '@/config/brand'
import Reveal from '@/components/common/Reveal'
import { getStorefrontConfig } from '@/services/storefrontConfig'

export default function ContactPage() {
  const [page, setPage] = useState(null)
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
      .page('contact')
      .then((r) => setPage(r.data))
      .catch(() =>
        setPage({
          title: 'تماس با ما',
          body: 'از طریق فرم زیر تیکت پشتیبانی ثبت کنید تا تیم ما پاسخ دهد.',
        }),
      )
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
  const hasCompany = Boolean(companyPhone || companyEmail || companyAddress)

  return (
    <div>
      <Seo
        title="تماس با ما"
        description={`پشتیبانی ${brand.name} — پیام بگذارید تا سریع پاسخ دهیم`}
        path="/contact"
        jsonLd={organizationJsonLd({
          email: companyEmail,
          phone: companyPhone,
          address: companyAddress,
        })}
      />
      <section className="bg-hero-mesh px-4 py-14 text-white md:py-16">
        <Reveal className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-widest text-copper-400">CONTACT</p>
          <h1 className="mt-3 font-display text-4xl font-bold">{page?.title || 'تماس با ما'}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/60">{page?.body}</p>
        </Reveal>
      </section>
      <Reveal className={`mx-auto px-4 py-12 ${hasCompany ? 'grid max-w-5xl gap-8 lg:grid-cols-2' : 'max-w-xl'}`}>
        {hasCompany && (
          <aside className="rounded-2xl border border-mist-200 bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold text-ink-900">راه‌های ارتباطی</h2>
            <p className="mt-1 text-sm leading-7 text-ink-700/55">
              از این مسیرها هم می‌توانید با ما در ارتباط باشید.
            </p>
            <ul className="mt-5 space-y-4 text-sm text-ink-700/80">
              {companyPhone && (
                <li>
                  <a
                    href={`tel:${companyPhone}`}
                    className="flex items-start gap-3 rounded-xl outline-none transition hover:text-copper-600 focus-visible:ring-2 focus-visible:ring-copper-400"
                  >
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-copper-500" strokeWidth={1.75} aria-hidden />
                    <span>
                      <span className="block text-xs text-ink-700/45">تلفن</span>
                      {companyPhone}
                    </span>
                  </a>
                </li>
              )}
              {companyEmail && (
                <li>
                  <a
                    href={`mailto:${companyEmail}`}
                    className="flex items-start gap-3 rounded-xl outline-none transition hover:text-copper-600 focus-visible:ring-2 focus-visible:ring-copper-400"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-copper-500" strokeWidth={1.75} aria-hidden />
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
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-copper-500" strokeWidth={1.75} aria-hidden />
                  <span>
                    <span className="block text-xs text-ink-700/45">آدرس</span>
                    <span className="leading-7">{companyAddress}</span>
                  </span>
                </li>
              )}
            </ul>
          </aside>
        )}
        {sent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center text-sm text-emerald-800">
            <p>تیکت شما ثبت شد. به‌زودی پاسخ می‌دهیم.</p>
            {ticketNo && (
              <p className="mt-3 font-mono text-base font-semibold tracking-wide">{ticketNo}</p>
            )}
          </div>
        ) : (
          <form className="grid gap-4 rounded-2xl border border-mist-200 bg-white p-6 shadow-soft" onSubmit={submit}>
            <label>
              <span className="label">نام</span>
              <input className="input" name="name" value={form.name} onChange={onChange} required autoComplete="name" />
            </label>
            <label>
              <span className="label">ایمیل</span>
              <input
                className="input"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                autoComplete="email"
              />
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
            <label>
              <span className="label">موضوع</span>
              <input className="input" name="subject" value={form.subject} onChange={onChange} required />
            </label>
            <label>
              <span className="label">پیام</span>
              <textarea
                className="input min-h-[140px]"
                name="message"
                value={form.message}
                onChange={onChange}
                required
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary cursor-pointer" disabled={loading}>
              {loading ? 'در حال ارسال...' : 'ثبت تیکت پشتیبانی'}
            </button>
          </form>
        )}
      </Reveal>
    </div>
  )
}
