import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import Seo from '@/components/common/Seo'
import AuthShell, { AuthError, AuthSuccess, formatAuthError } from '@/components/auth/AuthShell'

export default function ResetPasswordPage() {
  const { uid, token } = useParams()
  const navigate = useNavigate()
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
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
      await authApi.passwordResetConfirm({
        uid,
        token,
        new_password1: password1,
        new_password2: password2,
      })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setError(formatAuthError(err, 'لینک نامعتبر است یا منقضی شده'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title="تنظیم رمز جدید" path="/reset-password" noindex />
      <AuthShell
        title="رمز جدید"
        subtitle="رمز عبور تازه‌ای برای حساب خود انتخاب کنید"
        footer={
          <Link to="/login" className="font-semibold text-copper-600 hover:text-copper-500">
            بازگشت به ورود
          </Link>
        }
      >
        {done ? (
          <AuthSuccess message="رمز با موفقیت تغییر کرد. در حال انتقال به صفحه ورود..." />
        ) : (
          <form onSubmit={submit} className="space-y-4">
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
              {loading ? 'در حال ذخیره...' : 'ذخیره رمز جدید'}
            </button>
          </form>
        )}
      </AuthShell>
    </>
  )
}
