import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import logoUrl from '@/assets/logo.svg'

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4'

const FADE_MS = 500
const REPLAY_GAP_MS = 100

const NAV_ITEMS = [
  { label: 'Features', to: '/products', chevron: true },
  { label: 'Solutions', to: '/categories', chevron: false },
  { label: 'Plans', to: '/about', chevron: false },
  { label: 'Learning', to: '/contact', chevron: true },
]

const MARQUEE_LOGOS = ['Vortex', 'Nimbus', 'Prysma', 'Cirrus', 'Kynder', 'Halcyn']

function fadeOpacity(el, from, to, duration, rafBucket, onDone) {
  const start = performance.now()
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration)
    el.style.opacity = String(from + (to - from) * t)
    if (t < 1) {
      rafBucket.id = requestAnimationFrame(tick)
    } else {
      onDone?.()
    }
  }
  rafBucket.id = requestAnimationFrame(tick)
}

function LogoMark({ name }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-3">
      <span className="liquid-glass flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-semibold text-foreground">
        {name.slice(0, 1)}
      </span>
      <span className="text-base font-semibold text-foreground">{name}</span>
    </span>
  )
}

export default function HomeVideoHero() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const rafBucket = { id: 0 }
    let cancelled = false
    let fadingOut = false
    let replayTimer = 0

    const cancelRaf = () => {
      if (rafBucket.id) cancelAnimationFrame(rafBucket.id)
      rafBucket.id = 0
    }

    if (reduce) {
      video.style.opacity = '1'
      video.pause()
      return undefined
    }

    video.style.opacity = '0'

    const onPlaying = () => {
      if (cancelled || fadingOut) return
      cancelRaf()
      fadeOpacity(video, Number(video.style.opacity) || 0, 1, FADE_MS, rafBucket)
    }

    const onTimeUpdate = () => {
      if (cancelled || fadingOut || !video.duration) return
      const remainingMs = (video.duration - video.currentTime) * 1000
      if (remainingMs <= FADE_MS) {
        fadingOut = true
        cancelRaf()
        fadeOpacity(video, Number(video.style.opacity) || 1, 0, FADE_MS, rafBucket)
      }
    }

    const onEnded = () => {
      if (cancelled) return
      cancelRaf()
      video.style.opacity = '0'
      fadingOut = false
      clearTimeout(replayTimer)
      replayTimer = window.setTimeout(() => {
        if (cancelled) return
        video.currentTime = 0
        const playPromise = video.play()
        if (playPromise?.catch) playPromise.catch(() => {})
      }, REPLAY_GAP_MS)
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)

    const playPromise = video.play()
    if (playPromise?.catch) playPromise.catch(() => {})

    return () => {
      cancelled = true
      cancelRaf()
      clearTimeout(replayTimer)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
    }
  }, [])

  const marqueeItems = [...MARQUEE_LOGOS, ...MARQUEE_LOGOS]

  return (
    <section
      dir="ltr"
      className="relative min-h-[100dvh] overflow-visible bg-hero-bg font-geist text-foreground"
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO}
          muted
          playsInline
          preload="auto"
        />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col overflow-visible">
        {/* Navbar */}
        <header className="w-full px-8 py-5">
          <div className="flex w-full flex-row items-center justify-between gap-4">
            <Link to="/" className="shrink-0">
              <img src={logoUrl} alt="DigiGaj" className="h-8 w-auto" height={32} />
            </Link>

            <nav
              className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
              aria-label="Hero navigation"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm text-foreground/90 transition hover:bg-white/5 hover:text-foreground"
                >
                  {item.label}
                  {item.chevron ? (
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2} aria-hidden />
                  ) : null}
                </Link>
              ))}
            </nav>

            <Link to="/register" className="btn-hero-secondary shrink-0 px-4 py-2">
              Sign Up
            </Link>
          </div>
          <div
            className="mt-[3px] h-px w-full bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
            aria-hidden
          />
        </header>

        {/* Center content */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-4">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[527px] w-[984px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 bg-gray-950 opacity-90 blur-[82px]"
            aria-hidden
          />

          <div className="relative z-[1] flex flex-col items-center text-center">
            <h1 className="font-general text-[clamp(4.5rem,18vw,13.75rem)] font-normal leading-[1.02] tracking-[-0.024em] md:text-[220px]">
              <span className="text-foreground">Power </span>
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(to left, #6366f1, #a855f7, #fcd34d)',
                }}
              >
                AI
              </span>
            </h1>
            <p className="mt-[9px] max-w-md text-lg leading-8 text-hero-sub opacity-80">
              The most powerful AI ever deployed
              <br />
              in talent acquisition
            </p>
            <Link to="/contact" className="btn-hero-secondary mt-[25px] px-[29px] py-[24px]">
              Schedule a Consult
            </Link>
          </div>
        </div>

        {/* Logo marquee */}
        <div className="relative z-[1] w-full pb-10">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-12 px-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="shrink-0 text-center text-sm text-foreground/50 sm:text-start">
              Relied on by brands
              <br />
              across the globe
            </p>
            <div className="min-w-0 flex-1 overflow-hidden" dir="ltr">
              <div className="flex w-max animate-logo-marquee gap-16 pr-16 will-change-transform motion-reduce:animate-none">
                {marqueeItems.map((name, i) => (
                  <LogoMark key={`${name}-${i}`} name={name} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
