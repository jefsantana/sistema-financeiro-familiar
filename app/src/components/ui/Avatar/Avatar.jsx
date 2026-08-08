import { useAuth } from '../../../contexts/AuthContext.jsx';
import styles from './Avatar.module.css';

const CORES_POR_POSICAO = ['var(--cor-primaria)', 'var(--cor-acento)'];

export function Avatar({ nome, tamanho = 'medio' }) {
  const { pessoas } = useAuth();
  const iniciais = (nome || '?').trim().slice(0, 1).toUpperCase();
  const posicao = pessoas.indexOf(nome);
  const cor = posicao >= 0 ? CORES_POR_POSICAO[posicao] : 'var(--cor-info)';

  return (
    <div className={`${styles.avatar} ${styles[tamanho]}`} style={{ backgroundColor: cor }} title={nome}>
      {iniciais}
    </div>
  );
}
