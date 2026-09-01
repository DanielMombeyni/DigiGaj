import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/services/api'
import Seo from '@/components/common/Seo'
import AuthShell, { AuthError, AuthSuccess, formatAuthError } from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.passwordReset(email.trim())
      setDone(true)
    } catch (err) {
      setError(formatAuthError(err, 'ارسال لینک بازیابی ناموفق بود'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title="فراموشی رمز عبور" description="بازیابی رمز عبور حساب مشتری" path="/forgot-password" noindex />
      <AuthShell
        title="بازیابی رمز"
        subtitle="ایمیل حساب خود را وارد کنید تا لینک بازنشانی برایتان ارسال شود"
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
          <div className="space-y-4">
            <AuthSuccess message="اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی ارسال شده است. صندوق ورودی و پوشه اسپم را بررسی کنید." />
            <Link to="/login" className="btn-secondary flex min-h-11 w-full items-center justify-center">
              بازگشت به ورود
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="label">ایمیل</span>
              <input
                className="input text-left"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
              />
            </label>
            <AuthError message={error} />
            <button type="submit" className="btn-primary min-h-11 w-full cursor-pointer" disabled={loading}>
              {loading ? 'در حال ارسال...' : 'ارسال لینک بازیابی'}
            </button>
          </form>
        )}
      </AuthShell>
    </>
  )
}
