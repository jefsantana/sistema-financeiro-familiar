import styles from './Avatar.module.css';

const CORES_POR_PESSOA = {
  Jeferson: 'var(--cor-primaria)',
  Raquel: 'var(--cor-acento)',
};

export function Avatar({ nome, tamanho = 'medio' }) {
  const iniciais = (nome || '?').trim().slice(0, 1).toUpperCase();
  const cor = CORES_POR_PESSOA[nome] || 'var(--cor-info)';

  return (
    <div className={`${styles.avatar} ${styles[tamanho]}`} style={{ backgroundColor: cor }} title={nome}>
      {iniciais}
    </div>
  );
}
