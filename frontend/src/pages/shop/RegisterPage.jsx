import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { authApi, shopApi } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import { brand } from '@/config/brand'
import Seo from '@/components/common/Seo'
import AuthShell, { AuthError, formatAuthError } from '@/components/auth/AuthShell'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import OtpCodeStep from '@/components/auth/OtpCodeStep'

const emptyForm = {
  username: '',
  email: '',
  phone: '',
  password1: '',
  password2: '',
}

export default function RegisterPage() {
  const applySession = useAuthStore((s) => s.applySession)
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({
    ...emptyForm,
    phone: location.state?.phone || '',
  })
  const [step, setStep] = useState('form')
  const [loading, setLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [googleClientId, setGoogleClientId] = useState('')
  const [debugCode, setDebugCode] = useState('')
  const [resendAfter, setResendAfter] = useState(60)

  useEffect(() => {
    shopApi
      .config()
      .then((r) => {
        setGoogleClientId(r.data.google_login?.enabled ? r.data.google_login.client_id || '' : '')
      })
      .catch(() => {})
  }, [])

  const onChange = (e) => {
    const value =
      e.target.name === 'username' ? e.target.value.replace(/\s+/g, '') : e.target.value
    setForm((f) => ({ ...f, [e.target.name]: value }))
  }

  const requestCode = async () => {
    setError('')
    if (form.password1 !== form.password2) {
      setError('تکرار رمز عبور مطابقت ندارد')
      return false
    }
    if (form.password1.length < 8) {
      setError('رمز عبور باید حداقل ۸ کاراکتر باشد')
      return false
    }
    setLoading(true)
    try {
      const { data } = await authApi.requestSignupOtp({
        username: form.username.replace(/\s+/g, ''),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password1: form.password1,
        password2: form.password2,
      })
      setDebugCode(data.debug_code || '')
      setResendAfter(data.resend_after || 60)
      setStep('otp')
      return true
    } catch (err) {
      setError(formatAuthError(err, 'ارسال کد تأیید ناموفق بود'))
      return false
    } finally {
      setLoading(false)
    }
  }

  const submitForm = async (e) => {
    e.preventDefault()
    await requestCode()
  }

  const confirmCode = async (code) => {
    setError('')
    setOtpLoading(true)
    try {
      const { data } = await authApi.confirmSignupOtp({
        phone: form.phone.trim(),
        code,
      })
      const access = data.access || data.access_token
      const refresh = data.refresh || data.refresh_token
      if (!access) throw new Error('No access token')
      await applySession({ access, refresh, user: data.user })
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(formatAuthError(err, 'کد تأیید نادرست است'))
    } finally {
      setOtpLoading(false)
    }
  }

  if (step === 'otp') {
    return (
      <>
        <Seo title="تأیید ثبت‌نام" path="/register" noindex />
        <OtpCodeStep
          phone={form.phone}
          title="تأیید ثبت‌نام"
          subtitle="بدون وارد کردن کد، حساب ساخته نمی‌شود"
          successText="اگر کد را وارد نکنید ثبت‌نام کامل نمی‌شود."
          submitLabel="تأیید و تکمیل ثبت‌نام"
          submitting={otpLoading}
          resending={loading}
          error={error}
          debugCode={debugCode}
          resendAfter={resendAfter}
          onSubmit={confirmCode}
          onResend={requestCode}
          onEditPhone={() => {
            setStep('form')
            setError('')
            setDebugCode('')
          }}
        />
      </>
    )
  }

  return (
    <>
      <Seo title="ثبت‌نام" description={`ایجاد حساب مشتری در ${brand.name}`} path="/register" noindex />
      <AuthShell
        title="ایجاد حساب"
        subtitle={`شماره موبایل الزامی است؛ ایمیل اختیاری است`}
        footer={
          <>
            قبلاً ثبت‌نام کرده‌اید؟{' '}
            <Link to="/login" className="font-semibold text-copper-600 hover:text-copper-500">
              وارد شوید
            </Link>
          </>
        }
      >
        <form onSubmit={submitForm} className="space-y-4">
          <label className="block">
            <span className="label">نام کاربری *</span>
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
            <span className="label">شماره موبایل *</span>
            <input
              className="input"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={onChange}
              placeholder="0912xxxxxxx"
              required
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="label">ایمیل (اختیاری)</span>
            <input
              className="input text-left"
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={onChange}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="label">رمز عبور *</span>
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
            <span className="label">تکرار رمز عبور *</span>
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
            {loading ? 'در حال ارسال کد...' : 'دریافت کد تأیید'}
          </button>
        </form>

        {googleClientId && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3 text-[11px] text-ink-700/40">
              <span className="h-px flex-1 bg-mist-200" />
              یا
              <span className="h-px flex-1 bg-mist-200" />
            </div>
            <GoogleSignInButton clientId={googleClientId} label="ثبت‌نام با گوگل" />
          </div>
        )}

        <p className="mt-4 text-[11px] leading-5 text-ink-700/40">
          بعد از دریافت کد، فقط با تأیید پیامک حساب ساخته می‌شود.
        </p>
      </AuthShell>
    </>
  )
}
