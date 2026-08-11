import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Table } from 'lucide-react';
import styles from './MenuExportar.module.css';

/**
 * Botão "Exportar" com um menu de 3 formatos (Excel, CSV, PDF).
 * Cada prop `ao*` é opcional — só chamada quando a opção correspondente
 * é escolhida — e pode ser assíncrona (o menu não espera terminar).
 */
export function MenuExportar({ aoExportarExcel, aoExportarCsv, aoExportarPdf, desabilitado = false }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function aoClicarFora(evento) {
      if (ref.current && !ref.current.contains(evento.target)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  function escolher(funcao) {
    setAberto(false);
    funcao?.();
  }

  return (
    <div className={styles.container} ref={ref}>
      <button
        type="button"
        className={styles.gatilho}
        onClick={() => setAberto((atual) => !atual)}
        disabled={desabilitado}
      >
        <Download size={16} /> Exportar
      </button>
      {aberto && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.item} onClick={() => escolher(aoExportarExcel)}>
            <FileSpreadsheet size={15} /> Exportar Excel
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => escolher(aoExportarCsv)}>
            <Table size={15} /> Exportar CSV
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => escolher(aoExportarPdf)}>
            <FileText size={15} /> Exportar PDF
          </button>
        </div>
      )}
    </div>
  );
}
