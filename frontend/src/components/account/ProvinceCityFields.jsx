import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { citiesOf, IRAN_PROVINCES } from '@/data/iranLocations'

function fold(value) {
  return String(value || '')
    .replace(/\u200c/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[آأإ]/g, 'ا')
    .trim()
}

const PROVINCE_NAMES = IRAN_PROVINCES.map((row) => row.name)

function startsWithQuery(name, query) {
  const q = fold(query)
  if (!q) return true
  return fold(name).startsWith(q)
}

function SearchSelect({ label, value, options, placeholder, disabled, emptyText, onChange }) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const matches = options.filter((name) => startsWithQuery(name, query))
  const shown = open ? query : value || ''

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setQuery('')
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setQuery('')
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    if (disabled) {
      el.setCustomValidity('')
      return
    }
    el.setCustomValidity(options.includes(value) ? '' : 'از فهرست انتخاب کنید')
  }, [disabled, options, value])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId, open])

  const pick = (name) => {
    onChange(name)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (matches[active]) pick(matches[active])
    }
  }

  return (
    <label className="block">
      <span className="label">{label}</span>
      <div ref={rootRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-opt-${active}` : undefined}
          aria-required="true"
          autoComplete="off"
          className="select-field pe-10 disabled:cursor-not-allowed disabled:bg-mist-50"
          placeholder={placeholder}
          disabled={disabled}
          value={shown}
          onMouseDown={(e) => {
            if (disabled) return
            e.preventDefault()
            setQuery('')
            setOpen(true)
            inputRef.current?.focus()
          }}
          onFocus={() => {
            if (disabled) return
            setQuery('')
            setOpen(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`نمایش ${label}`}
          disabled={disabled}
          className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-ink-700/45 outline-none hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-copper-400 disabled:cursor-not-allowed"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return
            setQuery('')
            setOpen((v) => !v)
            inputRef.current?.focus()
          }}
        >
          <ChevronDown
            className={`h-4 w-4 transition duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
        {open && !disabled && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            aria-label={label}
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-mist-200 bg-white py-1 shadow-soft"
          >
            {matches.length === 0 ? (
              <li className="px-4 py-2.5 text-sm text-ink-700/50">{emptyText}</li>
            ) : (
              matches.map((name, index) => (
                <li key={name} role="presentation">
                  <button
                    id={`${listId}-opt-${index}`}
                    type="button"
                    role="option"
                    aria-selected={name === value}
                    className={`flex w-full cursor-pointer px-4 py-2.5 text-start text-sm outline-none ${
                      index === active
                        ? 'bg-copper-500/10 font-semibold text-copper-600'
                        : 'text-ink-900 hover:bg-mist-50'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(name)}
                  >
                    {name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </label>
  )
}

export default function ProvinceCityFields({ province, city, onChange }) {
  const cities = citiesOf(province)
  const cityValue = cities.includes(city) ? city : ''

  return (
    <>
      <SearchSelect
        label="استان *"
        value={province}
        options={PROVINCE_NAMES}
        placeholder="انتخاب استان"
        emptyText="استانی با این شروع پیدا نشد"
        onChange={(next) => {
          if (next === province) return
          onChange({ province: next, city: '' })
        }}
      />
      <SearchSelect
        key={province || 'no-province'}
        label="شهر *"
        value={cityValue}
        options={cities}
        placeholder={province ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید'}
        emptyText="شهری با این شروع پیدا نشد"
        disabled={!province}
        onChange={(next) => onChange({ province, city: next })}
      />
    </>
  )
}
