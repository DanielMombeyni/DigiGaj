import { digitsEnToFa, addCommas } from '@persian-tools/persian-tools'

export function toman(n) {
  if (n == null) return '—'
  return `${digitsEnToFa(addCommas(Number(n)))} تومان`
}

export function faDigits(n) {
  return digitsEnToFa(String(n ?? ''))
}

export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
