import AdminModal, { ModalCancelButton, ModalDangerButton } from '@/components/dashboard/AdminModal'

/**
 * Unified confirm dialog — use via useConfirm() so every confirm on the site looks the same.
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'تأیید',
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  loading = false,
  tone = 'danger',
}) {
  return (
    <AdminModal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <ModalCancelButton onClick={onClose} disabled={loading}>
            {cancelLabel}
          </ModalCancelButton>
          {tone === 'danger' ? (
            <ModalDangerButton onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </ModalDangerButton>
          ) : (
            <button
              type="button"
              className="btn-primary min-h-10 cursor-pointer px-5 disabled:opacity-50"
              disabled={loading}
              onClick={onConfirm}
            >
              {loading ? '...' : confirmLabel}
            </button>
          )}
        </>
      }
    />
  )
}
