import { useEffect, useMemo, useState } from 'react'
import {
  Home,
  Package,
  LayoutGrid,
  Info,
  Mail,
  ShoppingCart,
  LogIn,
  UserPlus,
  FileText,
  Sparkles,
  ExternalLink,
  ImageIcon,
  Globe,
  CheckCircle2,
  CircleOff,
  Palette,
  Paintbrush,
} from 'lucide-react'
import { adminApi } from '@/services/api'
import { AdminPageHeader, AdminCard, AdminStatCard } from '@/components/dashboard/AdminUI'
import { invalidateStorefrontConfig } from '@/services/storefrontConfig'
import { applyThemeToDocument } from '@/config/theme'
import { brand } from '@/config/brand'

const TAB_GENERAL = '__general__'
const TAB_COLORS = '__colors__'

const PAGE_ICONS = {
  home: Home,
  products: Package,
  categories: LayoutGrid,
  about: Info,
  contact: Mail,
  cart: ShoppingCart,
  login: LogIn,
  register: UserPlus,
}

const PAGE_GROUPS = [
  { id: 'general', label: 'تنظیمات عمومی', keys: [TAB_GENERAL, TAB_COLORS] },
  { id: 'main', label: 'صفحات اصلی', keys: ['home', 'products', 'categories', 'cart'] },
  { id: 'info', label: 'اطلاعات و محتوا', keys: ['about', 'contact'] },
  { id: 'auth', label: 'ورود و ثبت‌نام', keys: ['login', 'register'] },
  { id: 'cms', label: 'صفحات CMS', keys: [] },
]

const NAV_STATIC = {
  [TAB_GENERAL]: { key: TAB_GENERAL, label: 'آیکون و تم', kind: 'general' },
  [TAB_COLORS]: { key: TAB_COLORS, label: 'استایل و رنگ‌ها', kind: 'colors' },
}

function formatError(err) {
  const detail = err.response?.data
  if (!detail) return err.message || 'خطا در ذخیره'
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object') {
    const parts = Object.entries(detail).flatMap(([key, val]) => {
      if (Array.isArray(val)) return val.map((m) => `${key}: ${m}`)
      if (typeof val === 'string') return [val]
      return []
    })
    if (parts.length) return parts.join(' · ')
  }
  return 'خطا در ذخیره'
}

function StatusBadge({ enabled }) {
  return enabled ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      فعال
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-mist-100 px-2 py-0.5 text-[11px] font-medium text-ink-700/50">
      <CircleOff className="h-3 w-3" />
      غیرفعال
    </span>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-mist-200 bg-mist-50/40 p-4">
      <div>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        {description && <p className="mt-1 text-xs leading-6 text-ink-700/50">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-mist-300'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'right-0.5' : 'right-[calc(100%-1.625rem)]'}`}
        />
      </button>
    </div>
  )
}

function PageIcon({ pageKey, kind }) {
  if (pageKey === TAB_GENERAL) return <Globe className="h-4 w-4 shrink-0" strokeWidth={1.75} />
  if (pageKey === TAB_COLORS) return <Palette className="h-4 w-4 shrink-0" strokeWidth={1.75} />
  if (kind === 'cms') return <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} />
  const Icon = PAGE_ICONS[pageKey] || FileText
  return <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="block rounded-xl border border-mist-200 bg-white p-3">
      <span className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-ink-700">
        {label}
        <span className="font-mono text-[10px] text-ink-700/45" dir="ltr">
          {value}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-mist-200 bg-transparent p-1"
        />
        <input
          className="input font-mono text-xs"
          dir="ltr"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
        />
      </div>
    </label>
  )
}

export default function AdminStorefrontPagesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [activeTab, setActiveTab] = useState(TAB_GENERAL)
  const [siteIcon, setSiteIcon] = useState('')
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState('')
  const [clearIcon, setClearIcon] = useState(false)
  const [pages, setPages] = useState([])
  const [homeHero, setHomeHero] = useState({ title: '', subtitle: '', image: '' })
  const [homeEnabled, setHomeEnabled] = useState(true)
  const [heroImageFile, setHeroImageFile] = useState(null)
  const [heroImagePreview, setHeroImagePreview] = useState('')
  const [heroClearImage, setHeroClearImage] = useState(false)
  const [theme, setTheme] = useState('classic')
  const [themes, setThemes] = useState([])
  const [colors, setColors] = useState({})
  const [colorFields, setColorFields] = useState([])

  const cmsPages = useMemo(() => pages.filter((p) => p.kind === 'cms'), [pages])
  const activePage =
    activeTab === TAB_GENERAL || activeTab === TAB_COLORS
      ? null
      : pages.find((p) => p.key === activeTab)

  const stats = useMemo(() => {
    const enabled = pages.filter((p) => p.enabled !== false).length
    return {
      total: pages.length,
      enabled,
      disabled: pages.length - enabled,
    }
  }, [pages])

  const navGroups = useMemo(() => {
    const cmsKeys = cmsPages.map((p) => p.key)
    return PAGE_GROUPS.map((g) => ({
      ...g,
      keys: g.id === 'cms' ? cmsKeys : g.keys,
    })).filter((g) => g.keys.length > 0)
  }, [cmsPages])

  const applyLoadedAppearance = (data) => {
    setTheme(data.theme || 'classic')
    setThemes(data.themes || [])
    setColors(data.colors || {})
    setColorFields(data.color_fields || [])
    applyThemeToDocument(data.theme || 'classic', data.colors || {})
  }

  const load = () =>
    adminApi.storefrontPages
      .get()
      .then((r) => {
        const data = r.data
        setSiteIcon(data.site_icon || '')
        setIconPreview(data.site_icon || '')
        setPages(data.pages || [])
        applyLoadedAppearance(data)
        const home = (data.pages || []).find((p) => p.key === 'home')
        if (home) {
          setHomeEnabled(home.enabled !== false)
          setHomeHero({
            title: home.hero?.title || '',
            subtitle: home.hero?.subtitle || '',
            image: home.hero?.image || '',
          })
          setHeroImagePreview(home.hero?.image || '')
        }
        setIconFile(null)
        setClearIcon(false)
        setHeroImageFile(null)
        setHeroClearImage(false)
      })
      .catch(() => setError('خطا در بارگذاری صفحات فروشگاه'))

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const selectTab = (key) => {
    setActiveTab(key)
    setError('')
    setOk('')
  }

  const saveGeneral = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setOk('')
    try {
      if (iconFile || clearIcon) {
        const fd = new FormData()
        if (iconFile) fd.append('site_icon', iconFile)
        if (clearIcon) fd.append('clear_site_icon', 'true')
        const iconRes = await adminApi.storefrontPages.update(fd)
        setSiteIcon(iconRes.data.site_icon || '')
        setIconPreview(iconRes.data.site_icon || '')
        setIconFile(null)
        setClearIcon(false)
      }
      const { data } = await adminApi.storefrontPages.update({
        theme,
        colors,
        apply_preset: false,
      })
      applyLoadedAppearance(data)
      invalidateStorefrontConfig()
      setOk('تنظیمات عمومی ذخیره شد.')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  const selectThemeCard = async (themeId) => {
    setTheme(themeId)
    const preset = themes.find((t) => t.id === themeId)
    if (preset?.colors) {
      setColors(preset.colors)
      applyThemeToDocument(themeId, preset.colors)
    }
    setSaving(true)
    setError('')
    setOk('')
    try {
      const { data } = await adminApi.storefrontPages.update({
        theme: themeId,
        apply_preset: true,
      })
      applyLoadedAppearance(data)
      invalidateStorefrontConfig()
      setOk('تم فروشگاه ذخیره شد.')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  const saveColors = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setOk('')
    try {
      const { data } = await adminApi.storefrontPages.update({
        theme,
        colors,
        apply_preset: false,
      })
      applyLoadedAppearance(data)
      invalidateStorefrontConfig()
      setOk('رنگ‌بندی ذخیره شد.')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  const resetColorsToTheme = () => {
    const preset = themes.find((t) => t.id === theme)
    if (preset?.colors) {
      setColors(preset.colors)
      applyThemeToDocument(theme, preset.colors)
    }
  }

  const updateColor = (key, value) => {
    setColors((prev) => {
      const next = { ...prev, [key]: value }
      applyThemeToDocument(theme, next)
      return next
    })
  }

  const saveHome = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setOk('')
    try {
      const fd = new FormData()
      fd.append('home_title', homeHero.title)
      fd.append('home_subtitle', homeHero.subtitle)
      fd.append('enabled', homeEnabled ? 'true' : 'false')
      if (heroImageFile) fd.append('home_image', heroImageFile)
      if (heroClearImage) fd.append('clear_image', 'true')
      const { data } = await adminApi.storefrontPages.update(fd)
      setPages(data.pages || [])
      const home = (data.pages || []).find((p) => p.key === 'home')
      if (home?.hero) {
        setHomeHero({
          title: home.hero.title || '',
          subtitle: home.hero.subtitle || '',
          image: home.hero.image || '',
        })
        setHeroImagePreview(home.hero.image || '')
      }
      setHeroImageFile(null)
      setHeroClearImage(false)
      setOk('تنظیمات صفحه اصلی ذخیره شد.')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  const savePageToggle = async (pageKey, enabled) => {
    setSaving(true)
    setError('')
    setOk('')
    try {
      const { data } = await adminApi.storefrontPages.update({ page_key: pageKey, enabled })
      setPages(data.pages || [])
      setOk(enabled ? 'صفحه فعال شد.' : 'صفحه غیرفعال شد.')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  const tabLabel =
    activeTab === TAB_GENERAL
      ? 'تنظیمات عمومی'
      : activeTab === TAB_COLORS
        ? 'استایل و رنگ‌بندی'
        : activePage?.label || 'صفحه'

  const previewPath = activePage?.path || '/'
  const themeLabel =
    themes.find((t) => t.id === theme)?.label ||
    ({ classic: 'کلاسیک', green: 'سبز', dark: 'دارک' }[theme] || theme)

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="صفحات فروشگاه"
        description="مدیریت نمایش صفحات عمومی، آیکون سایت و بخش گلس صفحه اصلی"
        actions={
          activePage ? (
            <a
              href={previewPath}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-dark inline-flex cursor-pointer items-center gap-2 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              پیش‌نمایش صفحه
            </a>
          ) : null
        }
      />

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminStatCard label="صفحات فعال" value={stats.enabled} accent="emerald" hint={`از ${stats.total} صفحه`} />
          <AdminStatCard label="صفحات غیرفعال" value={stats.disabled} accent="ink" hint="مخفی از منو و مسدود" />
          <AdminStatCard
            label="تم فعال"
            value={themeLabel}
            accent="copper"
            hint="ظاهر فروشگاه"
          />
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="h-96 animate-pulse rounded-2xl bg-white" />
          <div className="h-96 animate-pulse rounded-2xl bg-white" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <nav className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {navGroups.map((group) => (
              <AdminCard key={group.id} title={group.label} className="!p-3">
                <ul className="space-y-1">
                  {group.keys.map((key) => {
                    const page = NAV_STATIC[key] || pages.find((p) => p.key === key)
                    if (!page) return null
                    const active = activeTab === key
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => selectTab(key)}
                          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-right text-sm transition ${
                            active
                              ? 'bg-ink-950 text-white shadow-soft'
                              : 'text-ink-700/75 hover:bg-mist-50'
                          }`}
                        >
                          <PageIcon pageKey={key} kind={page.kind} />
                          <span className="min-w-0 flex-1 truncate font-medium">{page.label}</span>
                          {key !== TAB_GENERAL && key !== TAB_COLORS && (
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${page.enabled !== false ? 'bg-emerald-400' : 'bg-mist-300'}`}
                              aria-hidden
                            />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </AdminCard>
            ))}
          </nav>

          <AdminCard title={tabLabel}>
            {activeTab === TAB_GENERAL && (
              <form onSubmit={saveGeneral} className="space-y-6">
                <div className="rounded-2xl border border-mist-200 bg-gradient-to-br from-mist-50 to-white p-5">
                  <div className="flex flex-wrap items-start gap-5">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-mist-200 bg-white shadow-soft">
                      {iconPreview ? (
                        <img src={iconPreview} alt="" className="h-full w-full object-contain p-2" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-ink-700/25" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <h3 className="font-semibold text-ink-900">آیکون سایت (Favicon)</h3>
                        <p className="mt-1 text-sm leading-7 text-ink-700/55">
                          در تب مرورگر، بوکمارک و هنگام افزودن به صفحه اصلی موبایل نمایش داده می‌شود.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-primary inline-flex cursor-pointer text-xs">
                          انتخاب فایل
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setIconFile(file)
                              setClearIcon(false)
                              setIconPreview(URL.createObjectURL(file))
                            }}
                          />
                        </label>
                        {(iconPreview || siteIcon) && (
                          <button
                            type="button"
                            className="btn-ghost cursor-pointer text-xs text-red-600"
                            onClick={() => {
                              setIconFile(null)
                              setIconPreview('')
                              setClearIcon(true)
                            }}
                          >
                            حذف آیکون
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-ink-700/40">PNG، SVG یا ICO — حداکثر ۲ مگابایت</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Paintbrush className="h-4 w-4 text-copper-500" />
                    <h3 className="font-semibold text-ink-900">تم فروشگاه</h3>
                  </div>
                  <p className="mb-4 text-sm leading-7 text-ink-700/55">
                    یکی از تم‌های آماده را انتخاب کنید؛ بلافاصله ذخیره می‌شود و روی فروشگاه اعمال می‌گردد. جزئیات رنگ را
                    در تب «استایل و رنگ‌ها» تنظیم کنید.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(themes.length
                      ? themes
                      : [
                          { id: 'classic', label: 'کلاسیک (فعلی)', colors },
                          { id: 'green', label: 'سبز', colors },
                          { id: 'dark', label: 'دارک', colors },
                        ]
                    ).map((t) => {
                      const active = theme === t.id
                      const swatches = [
                        t.colors?.copper_500,
                        t.colors?.sea_500,
                        t.colors?.mist_50,
                        t.colors?.ink_950,
                      ].filter(Boolean)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectThemeCard(t.id)}
                          className={`cursor-pointer rounded-2xl border p-4 text-right transition ${
                            active
                              ? 'border-copper-500 bg-copper-500/5 shadow-soft ring-2 ring-copper-500/30'
                              : 'border-mist-200 bg-white hover:border-copper-400/40'
                          }`}
                        >
                          <div className="mb-3 flex gap-1.5">
                            {swatches.map((c) => (
                              <span
                                key={c}
                                className="h-6 w-6 rounded-full border border-black/5"
                                style={{ background: c }}
                              />
                            ))}
                          </div>
                          <p className="text-sm font-semibold text-ink-900">{t.label}</p>
                          {active && (
                            <p className="mt-1 text-[11px] font-medium text-copper-600">انتخاب‌شده</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button type="submit" className="btn-primary cursor-pointer disabled:opacity-60" disabled={saving}>
                  {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات عمومی'}
                </button>
              </form>
            )}

            {activeTab === TAB_COLORS && (
              <form onSubmit={saveColors} className="space-y-5">
                <p className="text-sm leading-7 text-ink-700/55">
                  رنگ‌های فروشگاه را با پیکر انتخاب کنید. تغییرات روی پیش‌نمایش همین پنل و پس از ذخیره روی فروشگاه اعمال می‌شود.
                </p>

                <div
                  className="overflow-hidden rounded-2xl border border-mist-200 p-5"
                  style={{
                    background: `linear-gradient(135deg, ${colors.mist_50 || '#f6f7f9'}, ${colors.mist_100 || '#eef1f5'})`,
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: colors.ink_700 || '#374151' }}>
                    پیش‌نمایش سریع
                  </p>
                  <p
                    className="mt-2 font-display text-xl font-bold"
                    style={{ color: colors.ink_950 || '#0b1220' }}
                  >
                    {brand.name}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
                      style={{ background: colors.copper_500 || '#d97757' }}
                    >
                      دکمه اصلی
                    </span>
                    <span
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
                      style={{ background: colors.sea_500 || '#3b82b6' }}
                    >
                      ثانویه
                    </span>
                    <span
                      className="rounded-xl border px-4 py-2 text-xs font-semibold"
                      style={{
                        borderColor: colors.mist_200 || '#dce3ec',
                        color: colors.ink_900 || '#111827',
                        background: colors.mist_50 || '#fff',
                      }}
                    >
                      حاشیه
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {colorFields.map((field) => (
                    <ColorField
                      key={field.key}
                      label={field.label}
                      value={colors[field.key] || '#000000'}
                      onChange={(v) => updateColor(field.key, v)}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn-primary cursor-pointer disabled:opacity-60" disabled={saving}>
                    {saving ? 'در حال ذخیره...' : 'ذخیره رنگ‌بندی'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary cursor-pointer text-xs"
                    onClick={resetColorsToTheme}
                  >
                    بازگردانی به تم {themeLabel}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'home' && (
              <form onSubmit={saveHome} className="space-y-5">
                <Toggle
                  label="نمایش صفحه اصلی"
                  description="با غیرفعال کردن، کاربران به جای خانه به صفحه اول فعال هدایت نمی‌شوند — با احتیاط استفاده کنید."
                  checked={homeEnabled}
                  onChange={setHomeEnabled}
                />

                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <Sparkles className="h-4 w-4 text-copper-500" />
                    پیش‌نمایش کارت شیشه‌ای
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-hero-mesh p-4">
                    <div className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-transparent text-white">
                      {heroImagePreview ? (
                        <div className="relative min-h-0 flex-1">
                          <img src={heroImagePreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-white/5 text-sm text-white/30">
                          بدون تصویر
                        </div>
                      )}
                      <div className="relative shrink-0 p-5 pt-4">
                        <div className="h-px w-full bg-gradient-to-l from-copper-400 to-transparent" />
                        <p className="mt-4 font-display text-xl font-bold text-white/90">
                          {homeHero.title || 'اتمسفر دیجیتال'}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                          {homeHero.subtitle || 'تجربه خرید گجت، متفاوت'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="label">تصویر پس‌زمینه کارت</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="btn-dark cursor-pointer text-xs">
                        آپلود تصویر
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setHeroImageFile(file)
                            setHeroClearImage(false)
                            setHeroImagePreview(URL.createObjectURL(file))
                          }}
                        />
                      </label>
                      {(heroImagePreview || homeHero.image) && (
                        <button
                          type="button"
                          className="cursor-pointer text-xs text-red-600 hover:underline"
                          onClick={() => {
                            setHeroImageFile(null)
                            setHeroImagePreview('')
                            setHeroClearImage(true)
                          }}
                        >
                          حذف تصویر
                        </button>
                      )}
                    </div>
                  </label>
                  <label className="block">
                    <span className="label">عنوان</span>
                    <input
                      className="input"
                      value={homeHero.title}
                      onChange={(e) => setHomeHero({ ...homeHero, title: e.target.value })}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="label">توضیح کوتاه</span>
                    <input
                      className="input"
                      value={homeHero.subtitle}
                      onChange={(e) => setHomeHero({ ...homeHero, subtitle: e.target.value })}
                      maxLength={200}
                      required
                    />
                  </label>
                </div>

                <button type="submit" className="btn-primary cursor-pointer disabled:opacity-60" disabled={saving}>
                  {saving ? 'در حال ذخیره...' : 'ذخیره صفحه اصلی'}
                </button>
              </form>
            )}

            {activePage && activeTab !== 'home' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-mist-50/50 px-4 py-3">
                  <div>
                    <p className="text-xs text-ink-700/45">آدرس صفحه</p>
                    <p className="mt-0.5 font-mono text-sm text-ink-900" dir="ltr">
                      {activePage.path}
                    </p>
                  </div>
                  <StatusBadge enabled={activePage.enabled !== false} />
                </div>

                <Toggle
                  label={`${activePage.enabled !== false ? 'غیرفعال' : 'فعال'} کردن «${activePage.label}»`}
                  description={
                    activePage.kind === 'cms'
                      ? 'صفحات CMS از مدل محتوای سایت خوانده می‌شوند. غیرفعال کردن لینک و دسترسی مستقیم را می‌بندد.'
                      : 'با غیرفعال کردن، این صفحه از منوی فروشگاه حذف و URL آن مسدود می‌شود.'
                  }
                  checked={activePage.enabled !== false}
                  onChange={(enabled) => savePageToggle(activePage.key, enabled)}
                />

                {saving && (
                  <p className="text-xs text-ink-700/45">در حال اعمال تغییر...</p>
                )}
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  )
}
