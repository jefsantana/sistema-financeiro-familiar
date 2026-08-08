import { useAuth } from '../../../contexts/AuthContext.jsx';
import { posicaoDaPessoa } from '../../../utils/formatadores.js';
import styles from './Avatar.module.css';

const CORES_POR_POSICAO = ['var(--cor-primaria)', 'var(--cor-acento)'];

export function Avatar({ nome, tamanho = 'medio' }) {
  const { pessoas, familia } = useAuth();
  const iniciais = (nome || '?').trim().slice(0, 1).toUpperCase();
  const posicao = posicaoDaPessoa(pessoas, nome);
  const cor = posicao >= 0 ? CORES_POR_POSICAO[posicao] : 'var(--cor-info)';
  const foto = posicao === 0 ? familia?.foto_pessoa_1 : posicao === 1 ? familia?.foto_pessoa_2 : null;

  if (foto) {
    return (
      <div className={`${styles.avatar} ${styles[tamanho]}`} title={nome}>
        <img src={foto} alt={nome} className={styles.imagem} />
      </div>
    );
  }

  return (
    <div className={`${styles.avatar} ${styles[tamanho]}`} style={{ backgroundColor: cor }} title={nome}>
      {iniciais}
    </div>
  );
}
