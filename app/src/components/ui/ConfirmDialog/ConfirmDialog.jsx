import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal/Modal.jsx';
import { Button } from '../Button/Button.jsx';
import styles from './ConfirmDialog.module.css';

export function ConfirmDialog({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo = 'Tem certeza?',
  mensagem,
  textoConfirmar = 'Excluir',
  textoCancelar = 'Cancelar',
  variantePerigo = true,
  confirmarDesabilitado = false,
  children,
}) {
  const [carregando, setCarregando] = useState(false);

  async function confirmar() {
    setCarregando(true);
    try {
      await aoConfirmar();
      aoFechar();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo}>
      {variantePerigo && (
        <div className={styles.icone}>
          <AlertTriangle size={22} />
        </div>
      )}
      {mensagem && <p className={styles.mensagem}>{mensagem}</p>}
      {children && <div className={styles.conteudoExtra}>{children}</div>}
      <div className={styles.acoes}>
        <Button variante="secundario" onClick={aoFechar} disabled={carregando}>
          {textoCancelar}
        </Button>
        <Button
          variante={variantePerigo ? 'perigo' : 'primario'}
          onClick={confirmar}
          carregando={carregando}
          disabled={confirmarDesabilitado}
        >
          {textoConfirmar}
        </Button>
      </div>
    </Modal>
  );
}
