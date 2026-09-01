import { useEffect, useState } from 'react'
import { accountApi } from '@/services/api'
import { AccountCard, EmptyState } from '@/components/account/AccountUI'

const emptyForm = {
  label: '',
  full_name: '',
  phone: '',
  address: '',
  province: '',
  city: '',
  postal_code: '',
}

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState([])
  const [maxAddresses, setMaxAddresses] = useState(5)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () =>
    Promise.all([accountApi.addresses.list(), accountApi.profile.get()])
      .then(([addrRes, profileRes]) => {
        setAddresses(addrRes.data.results || addrRes.data)
        setMaxAddresses(profileRes.data.max_addresses || 5)
      })
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const atLimit = addresses.length >= maxAddresses

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await accountApi.addresses.create(form)
      setAddresses((list) => [data, ...list.map((a) => ({ ...a, is_active: false }))])
      setForm(emptyForm)
      setShowForm(false)
    } catch (err) {
      const detail = err.response?.data
      setError(detail?.detail || detail?.address || 'خطا در ذخیره آدرس')
    } finally {
      setSaving(false)
    }
  }

  const activate = async (id) => {
    setBusyId(id)
    try {
      const { data } = await accountApi.addresses.activate(id)
      setAddresses((list) =>
        list.map((a) => ({ ...a, is_active: a.id === data.id })),
      )
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('این آدرس حذف شود؟')) return
    setBusyId(id)
    try {
      await accountApi.addresses.remove(id)
      setAddresses((list) => {
        const next = list.filter((a) => a.id !== id)
        return next
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <AccountCard
        title="آدرس‌های من"
        actions={
          <button
            type="button"
            className="btn-primary cursor-pointer text-xs disabled:opacity-50"
            disabled={atLimit}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'انصراف' : 'آدرس جدید'}
          </button>
        }
      >
        <p className="mb-4 text-sm text-ink-700/55">
          حداکثر {maxAddresses} آدرس — فقط یک آدرس فعال. با افزودن آدرس جدید، همان به‌عنوان فعال ذخیره می‌شود.
          {atLimit && ' برای افزودن آدرس جدید، یکی از آدرس‌های قبلی را حذف کنید.'}
        </p>

        {showForm && (
          <form onSubmit={submit} className="mb-6 grid gap-3 rounded-xl border border-mist-200 bg-mist-50/50 p-4 sm:grid-cols-2">
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{error}</p>
            )}
            <label className="block sm:col-span-2">
              <span className="label">عنوان (اختیاری)</span>
              <input className="input" placeholder="مثلاً خانه" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">نام گیرنده</span>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label className="block">
              <span className="label">موبایل</span>
              <input className="input" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">آدرس کامل *</span>
              <textarea className="input min-h-24 resize-y" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </label>
            <label className="block">
              <span className="label">استان *</span>
              <input className="input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} required />
            </label>
            <label className="block">
              <span className="label">شهر *</span>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">کد پستی *</span>
              <input
                className="input"
                dir="ltr"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                value={form.postal_code}
                onChange={(e) =>
                  setForm({ ...form, postal_code: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                required
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary cursor-pointer text-xs" disabled={saving}>
                {saving ? 'در حال ذخیره...' : 'ذخیره آدرس (فعال)'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-mist-100" />
            ))}
          </div>
        ) : addresses.length ? (
          <div className="space-y-3">
            {addresses.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-4 ${
                  a.is_active ? 'border-copper-400/50 bg-copper-500/5' : 'border-mist-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-900">
                        {a.label || 'آدرس'}
                      </span>
                      {a.is_active && (
                        <span className="rounded-lg bg-copper-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          فعال
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-ink-700/70">
                      {a.full_name} · {a.phone}
                      <br />
                      {[a.province, a.city].filter(Boolean).join('، ')}
                      {(a.province || a.city) && ' — '}
                      {a.address}
                      {a.postal_code && <><br />کد پستی: {a.postal_code}</>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!a.is_active && (
                      <button
                        type="button"
                        className="cursor-pointer rounded-xl border border-mist-200 px-3 py-2 text-xs hover:bg-mist-50 disabled:opacity-50"
                        disabled={busyId === a.id}
                        onClick={() => activate(a.id)}
                      >
                        فعال‌سازی
                      </button>
                    )}
                    <button
                      type="button"
                      className="cursor-pointer rounded-xl border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      disabled={busyId === a.id}
                      onClick={() => remove(a.id)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="آدرسی ثبت نشده است." />
        )}
      </AccountCard>
    </div>
  )
}
