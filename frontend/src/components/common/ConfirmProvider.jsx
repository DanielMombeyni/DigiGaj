import { createContext, useCallback, useContext, useRef, useState } from 'react'
import ConfirmModal from '@/components/common/ConfirmModal'

const ConfirmContext = createContext(null)

const DEFAULTS = {
  title: 'تأیید عملیات',
  description: '',
  confirmLabel: 'تأیید',
  cancelLabel: 'انصراف',
  tone: 'danger',
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(false)
  const resolverRef = useRef(null)

  const finish = useCallback((value) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setLoading(false)
    setState(null)
  }, [])

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      // resolve any pending confirm as cancelled
      if (resolverRef.current) {
        resolverRef.current(false)
      }
      resolverRef.current = resolve
      setLoading(false)
      setState({ ...DEFAULTS, ...options })
    })
  }, [])

  const onConfirm = async () => {
    const onConfirmAsync = state?.onConfirm
    if (typeof onConfirmAsync === 'function') {
      setLoading(true)
      try {
        await onConfirmAsync()
        finish(true)
      } catch {
        setLoading(false)
      }
      return
    }
    finish(true)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        open={!!state}
        title={state?.title}
        description={state?.description}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        tone={state?.tone}
        loading={loading}
        onClose={() => finish(false)}
        onConfirm={onConfirm}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm باید داخل ConfirmProvider استفاده شود')
  }
  return ctx
}
