import { brand } from '@/config/brand'

const SIZES = {
  xs: 'text-xs font-bold',
  sm: 'text-sm font-extrabold',
  md: 'text-xl font-extrabold',
  lg: 'text-2xl font-extrabold',
  hero: 'text-5xl font-extrabold md:text-6xl lg:text-7xl',
}

/**
 * Styled site name: copper accent + rest (e.g. دیجی + گج)
 */
export default function BrandLogo({
  size = 'md',
  className = '',
  accentClass = 'text-copper-400',
  restClass = '',
}) {
  return (
    <span className={`font-display tracking-tight ${SIZES[size] || SIZES.md} ${className}`}>
      <span className={accentClass}>{brand.accent}</span>
      <span className={restClass}> {brand.rest}</span>
    </span>
  )
}

export { brand }
