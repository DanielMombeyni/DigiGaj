import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import Seo from '@/components/common/Seo'
import AuthShell, { AuthError, AuthSuccess, formatAuthError } from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')
  const [sent, setSent] = useState(false)
  const [debugCode, setDebugCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const requestCode = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.requestPasswordOtp(phone.trim())
      setSent(true)
      setDebugCode(data.debug_code || '')
    } catch (err) {
      setError(formatAuthError(err, 'ارسال کد ناموفق بود'))
    } finally {
      setLoading(false)
    }
  }

  const confirm = async (e) => {
    e.preventDefault()
    setError('')
    if (password1 !== password2) {
      setError('تکرار رمز عبور مطابقت ندارد')
      return
    }
    if (password1.length < 8) {
      setError('رمز عبور باید حداقل ۸ کاراکتر باشد')
      return
    }
    setLoading(true)
    try {
      await authApi.confirmPasswordOtp({
        phone: phone.trim(),
        code: code.trim(),
        new_password1: password1,
        new_password2: password2,
      })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1600)
    } catch (err) {
      setError(formatAuthError(err, 'کد نامعتبر است یا منقضی شده'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title="فراموشی رمز عبور" description="بازیابی رمز عبور با کد پیامکی" path="/forgot-password" noindex />
      <AuthShell
        title="بازیابی رمز"
        subtitle="شماره موبایل حساب را وارد کنید تا کد پیامکی برایتان ارسال شود"
        footer={
          <>
            رمز را به یاد آوردید؟{' '}
            <Link to="/login" className="font-semibold text-copper-600 hover:text-copper-500">
              ورود
            </Link>
          </>
        }
      >
        {done ? (
          <AuthSuccess message="رمز عبور تغییر کرد. در حال انتقال به صفحه ورود..." />
        ) : !sent ? (
          <form onSubmit={requestCode} className="space-y-4">
            <label className="block">
              <span className="label">شماره موبایل</span>
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912xxxxxxx"
                required
              />
            </label>
            <AuthError message={error} />
            <button type="submit" className="btn-primary min-h-11 w-full cursor-pointer" disabled={loading}>
              {loading ? 'در حال ارسال...' : 'دریافت کد'}
            </button>
          </form>
        ) : (
          <form onSubmit={confirm} className="space-y-4">
            <label className="block">
              <span className="label">شماره موبایل</span>
              <input className="input" value={phone} dir="ltr" disabled />
            </label>
            <label className="block">
              <span className="label">کد تأیید</span>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="کد ۶ رقمی"
                required
              />
              {debugCode && (
                <span className="mt-1 block text-[11px] text-amber-700">کد آزمایشی: {debugCode}</span>
              )}
            </label>
            <label className="block">
              <span className="label">رمز عبور جدید</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className="block">
              <span className="label">تکرار رمز عبور</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <AuthError message={error} />
            <button type="submit" className="btn-primary min-h-11 w-full cursor-pointer" disabled={loading}>
              {loading ? 'در حال ذخیره...' : 'تغییر رمز'}
            </button>
            <div className="flex items-center justify-between gap-3 text-xs">
              <button
                type="button"
                className="cursor-pointer text-sea-600 hover:text-copper-600"
                onClick={requestCode}
                disabled={loading}
              >
                ارسال مجدد کد
              </button>
              <button
                type="button"
                className="cursor-pointer text-ink-700/55 hover:text-ink-900"
                onClick={() => {
                  setSent(false)
                  setCode('')
                  setDebugCode('')
                  setError('')
                }}
              >
                تغییر شماره
              </button>
            </div>
          </form>
        )}
      </AuthShell>
    </>
  )
}
