import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

export function Modal({ aberto, aoFechar, titulo, children }) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return createPortal(
    <div className={styles.sobreposicao} onClick={aoFechar}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(evento) => evento.stopPropagation()}
      >
        {titulo && (
          <div className={styles.cabecalho}>
            <h3 className={styles.titulo}>{titulo}</h3>
            <button type="button" className={styles.botaoFechar} onClick={aoFechar} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={styles.corpo}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
