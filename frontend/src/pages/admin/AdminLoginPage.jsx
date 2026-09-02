import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import Seo from '@/components/common/Seo'
import { brand } from '@/config/brand'
import { PANEL_BASE, PANEL_LOGIN } from '@/config/panel'

export default function AdminLoginPage() {
  const login = useAuthStore((s) => s.login)
  const loading = useAuthStore((s) => s.loading)
  const user = useAuthStore((s) => s.user)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMe().then((u) => {
      if (u?.is_staff) navigate(PANEL_BASE, { replace: true })
    })
  }, [fetchMe, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password, { requireStaff: true })
      navigate(PANEL_BASE, { replace: true })
    } catch (err) {
      if (err?.code === 'NOT_STAFF') {
        setError('این حساب به پنل مدیریت دسترسی ندارد')
        return
      }
      const detail =
        err?.response?.data?.detail ||
        (Array.isArray(err?.response?.data?.errors?.detail)
          ? err.response.data.errors.detail[0]
          : err?.response?.data?.errors?.detail) ||
        (err?.code === 'ERR_NETWORK' ? 'ارتباط با سرور برقرار نشد' : null)
      setError(detail || 'نام کاربری یا رمز عبور نادرست است')
    }
  }

  if (user?.is_staff) return null

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      <Seo title="ورود مدیریت" description={`ورود به پنل مدیریت ${brand.name}`} path={PANEL_LOGIN} noindex />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-20 top-10 h-80 w-80 rounded-full bg-copper-500/20 blur-3xl animate-orb" />
        <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-sea-500/15 blur-3xl animate-orb-slow" />
        <div className="hero-noise absolute inset-0 opacity-30" />
      </div>

      <div className="relative w-full max-w-md animate-rise">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-copper-500/20 text-copper-400 ring-1 ring-copper-400/30">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.7} />
          </div>
          <h1 className="font-display text-2xl font-extrabold">
            <span className="text-copper-400">پنل</span> مدیریت
          </h1>
          <p className="mt-2 text-sm text-white/50">ورود ویژه کارکنان {brand.name}</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-3xl border border-mist-50/10 bg-surface/95 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur"
        >
          <label className="block">
            <span className="label">نام کاربری مدیریت</span>
            <input
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="mt-4 block">
            <span className="label">رمز عبور</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary mt-6 min-h-11 w-full cursor-pointer" disabled={loading}>
            {loading ? 'در حال ورود...' : 'ورود به پنل'}
          </button>
          <p className="mt-6 text-center text-xs text-ink-700/50">
            مشتری هستید؟{' '}
            <Link to="/login" className="font-medium text-sea-600 hover:text-copper-600">
              ورود فروشگاه
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
