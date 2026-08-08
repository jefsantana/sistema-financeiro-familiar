import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal/Modal.jsx';
import { Button } from '../ui/index.js';
import styles from './AjustarFotoPerfilModal.module.css';

const TAMANHO_SAIDA = 240;

function lerComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(leitor.error);
    leitor.onload = () => resolve(leitor.result);
    leitor.readAsDataURL(arquivo);
  });
}

function recortarQuadrado(dataUrlOriginal) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    imagem.onload = () => {
      const lado = Math.min(imagem.width, imagem.height);
      const origemX = (imagem.width - lado) / 2;
      const origemY = (imagem.height - lado) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = TAMANHO_SAIDA;
      canvas.height = TAMANHO_SAIDA;
      canvas.getContext('2d').drawImage(imagem, origemX, origemY, lado, lado, 0, 0, TAMANHO_SAIDA, TAMANHO_SAIDA);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    imagem.src = dataUrlOriginal;
  });
}

export function AjustarFotoPerfilModal({ arquivo, aoFechar, aoConfirmar }) {
  const [previa, setPrevia] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!arquivo) {
      setPrevia(null);
      return;
    }
    lerComoDataUrl(arquivo).then(setPrevia);
  }, [arquivo]);

  async function confirmar() {
    setSalvando(true);
    try {
      const dataUrlFinal = await recortarQuadrado(previa);
      await aoConfirmar(dataUrlFinal);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={Boolean(arquivo)} aoFechar={aoFechar} titulo="Ajustar sua foto">
      {previa && (
        <>
          <div className={styles.moldura}>
            <img src={previa} alt="Prévia da sua foto" />
          </div>
          <p className={styles.dica}>A imagem será recortada no centro, em formato quadrado.</p>
          <Button larguraTotal carregando={salvando} onClick={confirmar}>
            Salvar foto
          </Button>
        </>
      )}
    </Modal>
  );
}
