import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Seo from '@/components/common/Seo'
import AuthShell, { AuthError } from '@/components/auth/AuthShell'
import { useAuthStore } from '@/store/auth'
import { accountApi } from '@/services/api'

function errorText(err, fallback) {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data.detail === 'string') return data.detail
  if (typeof data === 'object') {
    const parts = Object.values(data).flatMap((value) => {
      if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
      return typeof value === 'string' ? [value] : []
    })
    if (parts.length) return parts.join(' ')
  }
  return fallback
}

function needsProfile(data) {
  const user = data?.user
  if (!user || user.is_staff) return false
  return !user.first_name?.trim() || !user.last_name?.trim() || !user.phone?.trim()
}

export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const code = params.get('code') || ''
    const state = params.get('state') || ''
    const storedState = sessionStorage.getItem('google_oauth_state') || ''
    const verifier = sessionStorage.getItem('google_oauth_verifier') || ''
    const redirectUri = sessionStorage.getItem('google_oauth_redirect') || ''
    const nextPath = sessionStorage.getItem('google_oauth_next') || '/'

    if (!code || !state || state !== storedState || !verifier || !redirectUri) {
      setError('ورود گوگل کامل نشد. دوباره تلاش کنید.')
      return
    }

    let cancelled = false
    loginWithGoogle({ code, code_verifier: verifier, redirect_uri: redirectUri })
      .then((data) => {
        if (cancelled) return
        sessionStorage.removeItem('google_oauth_state')
        sessionStorage.removeItem('google_oauth_verifier')
        sessionStorage.removeItem('google_oauth_redirect')
        if (needsProfile(data)) {
          const user = data.user
          setProfile({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            username: user.username || '',
            email: user.email || '',
            phone: user.phone || '',
            phoneLocked: Boolean(user.phone?.trim()),
            nextPath,
          })
          return
        }
        sessionStorage.removeItem('google_oauth_next')
        navigate(nextPath, { replace: true })
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorText(err, 'ورود با گوگل ناموفق بود'))
      })

    return () => {
      cancelled = true
    }
  }, [params, loginWithGoogle, navigate])

  const finish = (path) => {
    sessionStorage.removeItem('google_oauth_next')
    navigate(path || '/', { replace: true })
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await accountApi.profile.completeGoogle({
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        username: profile.username.replace(/\s+/g, ''),
        phone: profile.phone.trim(),
      })
      await fetchMe()
      finish(profile.nextPath)
    } catch (err) {
      setError(errorText(err, 'ثبت مشخصات ناموفق بود'))
    } finally {
      setSaving(false)
    }
  }

  const setField = (key) => (event) => {
    const value = key === 'username' ? event.target.value.replace(/\s+/g, '') : event.target.value
    setProfile((current) => ({ ...current, [key]: value }))
  }

  return (
    <>
      <Seo title="ورود با گوگل" path="/login/google/callback" noindex />
      <AuthShell
        title={profile ? 'تکمیل مشخصات' : 'ورود با گوگل'}
        subtitle={profile ? 'برای ساخت حساب، این اطلاعات لازم است' : 'در حال تکمیل ورود شما'}
      >
        {profile ? (
          <form onSubmit={saveProfile} className="space-y-4">
            <p className="text-sm leading-6 text-ink-700/70">
              حساب گوگل وصل شد. نام، نام خانوادگی، نام کاربری و شماره موبایل را تکمیل کنید.
            </p>
            <label className="block">
              <span className="label">نام *</span>
              <input
                className="input"
                autoComplete="given-name"
                value={profile.first_name}
                onChange={setField('first_name')}
                required
              />
            </label>
            <label className="block">
              <span className="label">نام خانوادگی *</span>
              <input
                className="input"
                autoComplete="family-name"
                value={profile.last_name}
                onChange={setField('last_name')}
                required
              />
            </label>
            <label className="block">
              <span className="label">نام کاربری *</span>
              <input
                className="input"
                dir="ltr"
                autoComplete="username"
                value={profile.username}
                onChange={setField('username')}
                required
                minLength={3}
              />
            </label>
            <label className="block">
              <span className="label">ایمیل</span>
              <input className="input bg-mist-50" dir="ltr" value={profile.email} readOnly disabled />
            </label>
            <label className="block">
              <span className="label">شماره موبایل *</span>
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={profile.phone}
                onChange={setField('phone')}
                placeholder="0912xxxxxxx"
                required
                readOnly={profile.phoneLocked}
                disabled={profile.phoneLocked}
              />
            </label>
            <AuthError message={error} />
            <button type="submit" className="btn-primary min-h-11 w-full cursor-pointer" disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ادامه'}
            </button>
          </form>
        ) : error ? (
          <div className="space-y-4">
            <AuthError message={error} />
            <Link to="/login" className="btn-secondary flex min-h-11 w-full items-center justify-center">
              بازگشت به ورود
            </Link>
          </div>
        ) : (
          <p className="text-sm text-ink-700/60">چند لحظه صبر کنید...</p>
        )}
      </AuthShell>
    </>
  )
}
