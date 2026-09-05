/** Storefront theme presets — keep in sync with backend/app/services/theme.py */

export const THEME_IDS = ['classic', 'green', 'dark']

export const THEME_PRESETS = {
  classic: {
    copper_400: '#e8a87c',
    copper_500: '#d97757',
    copper_600: '#c45c3e',
    copper_700: '#a34830',
    sea_400: '#5b9fd4',
    sea_500: '#3b82b6',
    sea_600: '#2f6a96',
    ink_950: '#0b1220',
    ink_900: '#111827',
    ink_800: '#1f2937',
    ink_700: '#374151',
    mist_50: '#f6f7f9',
    mist_100: '#eef1f5',
    mist_200: '#dce3ec',
  },
  green: {
    copper_400: '#6ee7b7',
    copper_500: '#10b981',
    copper_600: '#059669',
    copper_700: '#047857',
    sea_400: '#5eead4',
    sea_500: '#14b8a6',
    sea_600: '#0f766e',
    ink_950: '#052e1c',
    ink_900: '#064e3b',
    ink_800: '#065f46',
    ink_700: '#047857',
    mist_50: '#f0fdf7',
    mist_100: '#dcfce7',
    mist_200: '#bbf7d0',
  },
  dark: {
    copper_400: '#f0b089',
    copper_500: '#e8956a',
    copper_600: '#d97757',
    copper_700: '#b85a3c',
    sea_400: '#7eb8e0',
    sea_500: '#5b9fd4',
    sea_600: '#3b82b6',
    ink_950: '#f3f4f6',
    ink_900: '#e5e7eb',
    ink_800: '#d1d5db',
    ink_700: '#9ca3af',
    mist_50: '#0b1220',
    mist_100: '#111827',
    mist_200: '#1f2937',
  },
}

const CSS_MAP = {
  copper_400: '--color-copper-400',
  copper_500: '--color-copper-500',
  copper_600: '--color-copper-600',
  copper_700: '--color-copper-700',
  sea_400: '--color-sea-400',
  sea_500: '--color-sea-500',
  sea_600: '--color-sea-600',
  ink_950: '--color-ink-950',
  ink_900: '--color-ink-900',
  ink_800: '--color-ink-800',
  ink_700: '--color-ink-700',
  mist_50: '--color-mist-50',
  mist_100: '--color-mist-100',
  mist_200: '--color-mist-200',
}

export function resolveThemeColors(theme, colors = {}) {
  const preset = THEME_PRESETS[theme] || THEME_PRESETS.green
  const resolved = { ...preset }
  if (colors && typeof colors === 'object') {
    for (const key of Object.keys(CSS_MAP)) {
      const value = colors[key]
      if (value) resolved[key] = value
    }
  }
  return resolved
}

function hexToRgbChannels(hex) {
  const normalized = String(hex || '').replace('#', '')
  if (normalized.length !== 6) return '0 0 0'
  return `${parseInt(normalized.slice(0, 2), 16)} ${parseInt(normalized.slice(2, 4), 16)} ${parseInt(normalized.slice(4, 6), 16)}`
}

export function applyThemeToDocument(theme, colors = {}) {
  const themeId = THEME_IDS.includes(theme) ? theme : 'green'
  const resolved = resolveThemeColors(themeId, colors)
  const root = document.documentElement

  root.setAttribute('data-theme', themeId)
  Object.entries(CSS_MAP).forEach(([key, cssVar]) => {
    const hex = resolved[key]
    root.style.setProperty(cssVar, hex)
    root.style.setProperty(`${cssVar}-rgb`, hexToRgbChannels(hex))
  })
  root.style.setProperty('--brand', resolved.copper_500)

  const surfaceHex = themeId === 'dark' ? resolved.mist_100 : '#ffffff'
  root.style.setProperty('--color-surface', surfaceHex)
  root.style.setProperty('--color-surface-rgb', hexToRgbChannels(surfaceHex))
}
