import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import { brand } from '@/config/brand'
import Seo from '@/components/common/Seo'
import AuthShell, { AuthError, formatAuthError } from '@/components/auth/AuthShell'

export default function RegisterPage() {
  const applySession = useAuthStore((s) => s.applySession)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password1: '',
    password2: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password1 !== form.password2) {
      setError('تکرار رمز عبور مطابقت ندارد')
      return
    }
    if (form.password1.length < 8) {
      setError('رمز عبور باید حداقل ۸ کاراکتر باشد')
      return
    }
    setLoading(true)
    try {
      const { data } = await authApi.register({
        username: form.username.trim(),
        email: form.email.trim(),
        password1: form.password1,
        password2: form.password2,
      })
      const access = data.access || data.access_token
      const refresh = data.refresh || data.refresh_token
      if (access) {
        await applySession({ access, refresh, user: data.user })
      } else {
        await login(form.username.trim(), form.password1)
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(formatAuthError(err, 'ثبت‌نام ناموفق بود. اطلاعات را بررسی کنید'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title="ثبت‌نام" description={`ایجاد حساب مشتری در ${brand.name}`} path="/register" noindex />
      <AuthShell
        title="ایجاد حساب"
        subtitle={`چند لحظه تا عضویت در ${brand.name}`}
        footer={
          <>
            قبلاً ثبت‌نام کرده‌اید؟{' '}
            <Link to="/login" className="font-semibold text-copper-600 hover:text-copper-500">
              وارد شوید
            </Link>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="label">نام کاربری</span>
            <input
              className="input"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={onChange}
              required
              minLength={3}
            />
          </label>
          <label className="block">
            <span className="label">ایمیل</span>
            <input
              className="input text-left"
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={onChange}
              required
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="label">رمز عبور</span>
            <div className="relative">
              <input
                className="input pe-12"
                type={showPass ? 'text' : 'password'}
                name="password1"
                autoComplete="new-password"
                value={form.password1}
                onChange={onChange}
                required
                minLength={8}
              />
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/45 hover:text-ink-900"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'مخفی کردن رمز' : 'نمایش رمز'}
              >
                {showPass ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="label">تکرار رمز عبور</span>
            <input
              className="input"
              type={showPass ? 'text' : 'password'}
              name="password2"
              autoComplete="new-password"
              value={form.password2}
              onChange={onChange}
              required
              minLength={8}
            />
          </label>

          <AuthError message={error} />

          <button type="submit" className="btn-primary min-h-11 w-full cursor-pointer" disabled={loading}>
            {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام و ورود'}
          </button>
        </form>

        <p className="mt-4 text-[11px] leading-5 text-ink-700/40">
          با ثبت‌نام، شرایط استفاده از فروشگاه را می‌پذیرید.
        </p>
      </AuthShell>
    </>
  )
}
