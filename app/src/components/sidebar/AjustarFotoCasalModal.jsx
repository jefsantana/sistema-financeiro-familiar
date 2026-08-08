import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal/Modal.jsx';
import { Button } from '../ui/index.js';
import styles from './AjustarFotoCasalModal.module.css';

const LARGURA_MAXIMA_FOTO = 480;

function lerComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(leitor.error);
    leitor.onload = () => resolve(leitor.result);
    leitor.readAsDataURL(arquivo);
  });
}

function redimensionar(dataUrlOriginal) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    imagem.onload = () => {
      const escala = Math.min(1, LARGURA_MAXIMA_FOTO / imagem.width);
      const canvas = document.createElement('canvas');
      canvas.width = imagem.width * escala;
      canvas.height = imagem.height * escala;
      canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    imagem.src = dataUrlOriginal;
  });
}

export function AjustarFotoCasalModal({ arquivo, posicaoInicial = 50, aoFechar, aoConfirmar }) {
  const [previa, setPrevia] = useState(null);
  const [posicao, setPosicao] = useState(posicaoInicial);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!arquivo) {
      setPrevia(null);
      return;
    }
    setPosicao(posicaoInicial);
    lerComoDataUrl(arquivo).then(setPrevia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo]);

  async function confirmar() {
    setSalvando(true);
    try {
      const dataUrlFinal = await redimensionar(previa);
      await aoConfirmar(dataUrlFinal, posicao);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={Boolean(arquivo)} aoFechar={aoFechar} titulo="Ajustar foto do casal">
      {previa && (
        <>
          <div className={styles.moldura}>
            <img src={previa} alt="Prévia da foto do casal" style={{ objectPosition: `center ${posicao}%` }} />
          </div>

          <label className={styles.rotuloSlider} htmlFor="posicao-foto-casal">
            Posição da foto
          </label>
          <input
            id="posicao-foto-casal"
            type="range"
            min="0"
            max="100"
            value={posicao}
            onChange={(e) => setPosicao(Number(e.target.value))}
            className={styles.slider}
          />

          <Button larguraTotal carregando={salvando} onClick={confirmar}>
            Salvar foto
          </Button>
        </>
      )}
    </Modal>
  );
}
