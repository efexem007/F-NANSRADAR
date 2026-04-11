import { useCounter } from '../hooks/useCounter'

export default function AnimatedNumber({ value, prefix = '', suffix = '', fractionDigits = 1 }) {
  const count = useCounter(value, 1500)
  return <span>{prefix}{count.toFixed(fractionDigits)}{suffix}</span>
}
