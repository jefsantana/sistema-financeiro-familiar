import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import styles from './Toast.module.css';

export function ToastViewport({ toasts, aoFechar }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className={styles.viewport} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          {toast.tipo === 'erro' ? (
            <XCircle size={18} className={styles.iconeErro} />
          ) : (
            <CheckCircle2 size={18} className={styles.iconeSucesso} />
          )}
          <span className={styles.mensagem}>{toast.mensagem}</span>
          <button
            type="button"
            className={styles.botaoFechar}
            onClick={() => aoFechar(toast.id)}
            aria-label="Fechar aviso"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
