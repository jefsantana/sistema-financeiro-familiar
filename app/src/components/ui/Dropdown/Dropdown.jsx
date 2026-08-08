import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Dropdown.module.css';

export function Dropdown({ rotulo, itens, valorSelecionado, aoSelecionar }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function aoClicarFora(evento) {
      if (ref.current && !ref.current.contains(evento.target)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const itemAtual = itens.find((item) => item.valor === valorSelecionado);

  return (
    <div className={styles.container} ref={ref}>
      <button type="button" className={styles.gatilho} onClick={() => setAberto((a) => !a)}>
        {rotulo ? `${rotulo}: ${itemAtual?.rotulo ?? 'Todos'}` : (itemAtual?.rotulo ?? 'Selecione')}
        <ChevronDown className={`${styles.seta} ${aberto ? styles.setaAberta : ''}`} />
      </button>
      {aberto && (
        <div className={styles.menu} role="menu">
          {itens.map((item) => (
            <button
              key={item.valor}
              type="button"
              role="menuitem"
              className={`${styles.item} ${item.valor === valorSelecionado ? styles.itemAtivo : ''}`}
              onClick={() => {
                aoSelecionar(item.valor);
                setAberto(false);
              }}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
