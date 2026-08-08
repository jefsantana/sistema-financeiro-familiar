import { Check } from 'lucide-react';
import { Avatar } from '../ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from './SeletorPessoa.module.css';

export function SeletorPessoa({ valor, aoSelecionar, rotulo = 'Quem?' }) {
  const { pessoas } = useAuth();

  return (
    <div>
      {rotulo && (
        <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-secundario)', fontWeight: 600, marginBottom: '8px' }}>
          {rotulo}
        </p>
      )}
      <div className={styles.grupo} role="group" aria-label={rotulo}>
        {pessoas.map((pessoa) => (
          <button
            key={pessoa}
            type="button"
            aria-pressed={valor === pessoa}
            className={`${styles.opcao} ${valor === pessoa ? styles.opcaoAtiva : ''}`}
            onClick={() => aoSelecionar(pessoa)}
          >
            <Avatar nome={pessoa} tamanho="pequeno" />
            {pessoa}
            {valor === pessoa && <Check size={15} className={styles.check} />}
          </button>
        ))}
      </div>
    </div>
  );
}
