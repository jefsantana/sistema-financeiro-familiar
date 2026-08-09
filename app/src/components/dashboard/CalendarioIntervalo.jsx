import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CalendarioIntervalo.module.css';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function paraIso(ano, mes, dia) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function gerarDias(mesVisivel) {
  const ano = mesVisivel.getFullYear();
  const mes = mesVisivel.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const dias = [];
  for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
  for (let dia = 1; dia <= totalDias; dia++) dias.push(paraIso(ano, mes, dia));
  return dias;
}

export function CalendarioIntervalo({ inicio, fim, aoMudar }) {
  const [mesVisivel, setMesVisivel] = useState(() => (inicio ? new Date(`${inicio}T00:00:00`) : new Date()));

  function mudarMes(deslocamento) {
    setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + deslocamento, 1));
  }

  function aoClicarDia(iso) {
    if (!inicio || (inicio && fim)) {
      aoMudar({ inicio: iso, fim: null });
    } else if (iso < inicio) {
      aoMudar({ inicio: iso, fim: null });
    } else {
      aoMudar({ inicio, fim: iso });
    }
  }

  const dias = gerarDias(mesVisivel);
  const nomeMes = mesVisivel.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.calendario}>
      <div className={styles.cabecalho}>
        <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
          <ChevronLeft size={15} />
        </button>
        <span>{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</span>
        <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className={styles.grade}>
        {DIAS_SEMANA.map((dia, indice) => (
          <span key={indice} className={styles.diaSemana}>
            {dia}
          </span>
        ))}
        {dias.map((iso, indice) => {
          if (!iso) return <span key={`vazio-${indice}`} />;
          const noIntervalo = Boolean(inicio && fim && iso >= inicio && iso <= fim);
          const eExtremo = iso === inicio || iso === fim;
          return (
            <button
              key={iso}
              type="button"
              className={[styles.dia, noIntervalo && styles.noIntervalo, eExtremo && styles.extremo]
                .filter(Boolean)
                .join(' ')}
              onClick={() => aoClicarDia(iso)}
            >
              {Number(iso.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
