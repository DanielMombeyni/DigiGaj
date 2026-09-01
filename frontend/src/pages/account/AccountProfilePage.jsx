import { useEffect, useState } from 'react'
import { accountApi } from '@/services/api'
import { AccountCard } from '@/components/account/AccountUI'

function formatProfileErrors(err) {
  const data = err.response?.data
  if (!data) return err.message || 'خطا در ذخیره'
  if (typeof data.detail === 'string') return data.detail
  if (typeof data === 'object') {
    const parts = Object.entries(data).flatMap(([key, val]) => {
      if (Array.isArray(val)) return val.map((m) => `${key}: ${m}`)
      if (typeof val === 'string') return [val]
      return []
    })
    if (parts.length) return parts.join(' · ')
  }
  return 'خطا در ذخیره'
}

export default function AccountProfilePage() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    username: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    accountApi.profile
      .get()
      .then((r) => {
        const d = r.data
        setForm({
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          email: d.email || '',
          phone: d.phone || '',
          username: d.username || '',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
    }
    if (!payload.first_name || !payload.last_name || !payload.email) {
      setError('نام، نام خانوادگی و ایمیل الزامی هستند.')
      return
    }

    setSaving(true)
    setError('')
    setOk('')
    try {
      const { data } = await accountApi.profile.update(payload)
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        username: data.username || '',
      })
      setOk('پروفایل ذخیره شد.')
    } catch (err) {
      setError(formatProfileErrors(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AccountCard title="اطلاعات پروفایل">
      <p className="mb-4 text-sm leading-7 text-ink-700/55">
        همه فیلدهای زیر (به‌جز نام کاربری و موبایل) باید تکمیل شوند. شماره موبایل از
        طریق ثبت‌نام/ورود تنظیم می‌شود و قابل تغییر نیست.
      </p>
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-mist-100" />
      ) : (
        <form onSubmit={submit} className="grid max-w-lg gap-4 sm:grid-cols-2">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{error}</p>}
          {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-2">{ok}</p>}

          <label className="block sm:col-span-2">
            <span className="label">نام کاربری</span>
            <input className="input bg-mist-50 text-ink-700/60" dir="ltr" value={form.username} readOnly disabled />
          </label>

          <label className="block">
            <span className="label">نام *</span>
            <input
              className="input"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="label">نام خانوادگی *</span>
            <input
              className="input"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">ایمیل *</span>
            <input
              className="input"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">موبایل</span>
            <input
              className="input bg-mist-50 text-ink-700/60"
              dir="ltr"
              value={form.phone || '— ثبت نشده —'}
              readOnly
              disabled
            />
            <p className="mt-1.5 text-xs text-ink-700/45">شماره موبایل قابل ویرایش نیست.</p>
          </label>

          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary cursor-pointer" disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      )}
    </AccountCard>
  )
}
