import { useInView } from '@/hooks/useInView'
import { cn } from '@/utils/format'

export default function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}) {
  const [ref, inView] = useInView()
  return (
    <Tag
      ref={ref}
      className={cn('reveal reveal-scope', inView && 'reveal-in', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
