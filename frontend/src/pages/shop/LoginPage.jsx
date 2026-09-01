import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { authApi, shopApi } from '@/services/api'
import { brand } from '@/config/brand'
import Seo from '@/components/common/Seo'
import AuthShell, { AuthError, formatAuthError } from '@/components/auth/AuthShell'

const METHOD_META = {
  username_password: { id: 'username_password', label: 'نام کاربری', field: 'نام کاربری', placeholder: 'مثلاً ali' },
  email_password: { id: 'email_password', label: 'ایمیل', field: 'ایمیل', placeholder: 'ali@email.com', type: 'email' },
  phone_password: { id: 'phone_password', label: 'تلفن + رمز', field: 'شماره موبایل', placeholder: '0912xxxxxxx' },
  phone_otp: { id: 'phone_otp', label: 'تلفن + کد', field: 'شماره موبایل', placeholder: '0912xxxxxxx' },
}

const DEFAULT_METHODS = {
  username_password: true,
  email_password: false,
  phone_password: false,
  phone_otp: false,
}

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()
  const location = useLocation()
  const [methods, setMethods] = useState(DEFAULT_METHODS)
  const [method, setMethod] = useState('username_password')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [debugCode, setDebugCode] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

  const redirectTo = location.state?.from || '/'

  const enabled = useMemo(
    () => Object.entries(methods).filter(([, v]) => v).map(([k]) => k),
    [methods],
  )

  useEffect(() => {
    shopApi
      .config()
      .then((r) => {
        const m = { ...DEFAULT_METHODS, ...(r.data.auth_methods || {}) }
        setMethods(m)
        const first = Object.keys(METHOD_META).find((k) => m[k]) || 'username_password'
        setMethod(first)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setIdentifier('')
    setPassword('')
    setOtpCode('')
    setOtpSent(false)
    setDebugCode('')
    setError('')
  }, [method])

  const meta = METHOD_META[method] || METHOD_META.username_password

  const submitPassword = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(identifier.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(formatAuthError(err, 'اطلاعات ورود نادرست است'))
    }
  }

  const sendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setOtpLoading(true)
    try {
      const { data } = await authApi.requestOtp(identifier.trim())
      setOtpSent(true)
      setDebugCode(data.debug_code || '')
    } catch (err) {
      setError(formatAuthError(err, 'ارسال کد ناموفق بود'))
    } finally {
      setOtpLoading(false)
    }
  }

  const submitOtp = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await loginWithOtp(identifier.trim(), otpCode.trim())
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(formatAuthError(err, 'کد تأیید نادرست است'))
    }
  }

  return (
    <>
      <Seo title="ورود مشتریان" description={`ورود به حساب کاربری ${brand.name}`} path="/login" noindex />
      <AuthShell
        title="خوش آمدید"
        subtitle="برای ادامه خرید وارد حساب مشتری خود شوید"
        footer={
          <>
            حساب ندارید؟{' '}
            <Link to="/register" className="font-semibold text-copper-600 hover:text-copper-500">
              ثبت‌نام کنید
            </Link>
          </>
        }
      >
        {enabled.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {enabled.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  method === id
                    ? 'bg-ink-950 text-white'
                    : 'bg-mist-100 text-ink-700/60 hover:bg-mist-200'
                }`}
              >
                {METHOD_META[id].label}
              </button>
            ))}
          </div>
        )}

        {method === 'phone_otp' ? (
          <form onSubmit={otpSent ? submitOtp : sendOtp} className="space-y-4">
            <label className="block">
              <span className="label">{meta.field}</span>
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={meta.placeholder}
                required
                disabled={otpSent}
              />
            </label>
            {otpSent && (
              <label className="block">
                <span className="label">کد تأیید</span>
                <input
                  className="input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="کد ۶ رقمی"
                  required
                />
                {debugCode && (
                  <span className="mt-1 block text-[11px] text-amber-700">
                    کد آزمایشی: {debugCode}
                  </span>
                )}
              </label>
            )}
            <AuthError message={error} />
            <button
              type="submit"
              className="btn-primary min-h-11 w-full cursor-pointer"
              disabled={loading || otpLoading}
            >
              {otpSent
                ? loading
                  ? 'در حال ورود...'
                  : 'تأیید و ورود'
                : otpLoading
                  ? 'در حال ارسال...'
                  : 'دریافت کد'}
            </button>
            {otpSent && (
              <button
                type="button"
                className="w-full text-xs text-sea-600 hover:text-copper-600"
                onClick={() => {
                  setOtpSent(false)
                  setOtpCode('')
                  setDebugCode('')
                }}
              >
                تغییر شماره
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={submitPassword} className="space-y-4">
            <label className="block">
              <span className="label">{meta.field}</span>
              <input
                className="input"
                type={meta.type || 'text'}
                autoComplete={method === 'email_password' ? 'email' : 'username'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={meta.placeholder}
                required
              />
            </label>
            <label className="block">
              <span className="label">رمز عبور</span>
              <div className="relative">
                <input
                  className="input pe-12"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

            {method === 'email_password' && (
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs font-medium text-sea-600 hover:text-copper-600">
                  فراموشی رمز عبور؟
                </Link>
              </div>
            )}

            <AuthError message={error} />

            <button type="submit" className="btn-primary min-h-11 w-full cursor-pointer" disabled={loading}>
              {loading ? 'در حال ورود...' : 'ورود به حساب'}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-ink-700/40">
          <Link to="/" className="hover:text-copper-600">
            ← بازگشت به فروشگاه
          </Link>
        </p>
      </AuthShell>
    </>
  )
}
