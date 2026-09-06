import { useEffect, useRef, useState } from 'react'

/**
 * Observe element visibility for scroll reveals.
 * Default threshold is 0 so tall grids (e.g. 1-col product lists on mobile)
 * still count as intersecting when any pixel is in the viewport.
 */
export function useInView(options = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return undefined

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setInView(true)
      return undefined
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return undefined
    }

    let done = false
    const reveal = () => {
      if (done) return
      done = true
      setInView(true)
    }

    const isVisiblyInViewport = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || document.documentElement.clientHeight || 0
      const vw = window.innerWidth || document.documentElement.clientWidth || 0
      return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw
    }

    if (isVisiblyInViewport()) {
      reveal()
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal()
          observer.disconnect()
        }
      },
      {
        threshold: options.threshold ?? 0,
        rootMargin: options.rootMargin ?? '80px 0px 80px 0px',
      },
    )
    observer.observe(el)

    // Async mount / layout shift fallback (common after data load)
    const t = window.setTimeout(() => {
      if (isVisiblyInViewport()) reveal()
    }, 120)

    return () => {
      observer.disconnect()
      window.clearTimeout(t)
    }
  }, [inView, options.threshold, options.rootMargin])

  return [ref, inView]
}
