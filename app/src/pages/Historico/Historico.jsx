import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, History, FileSpreadsheet, FileText } from 'lucide-react';
import { Input, Select, Badge, Avatar, EmptyState, Loading, Table, TableColunaNumerica, Button } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { formatarData, formatarMoeda, nomeMesAno } from '../../utils/formatadores.js';
import { obterMesAno } from '../../utils/financeiro.js';
import { exportarExcel, exportarPdf } from '../../utils/exportarRelatorio.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { CATEGORIAS_GASTO_FIXAS, CATEGORIAS_ENTRADA_FIXAS } from '../../utils/constantes.js';
import { CategoriaComIcone } from '../../components/lancamentos/CategoriaComIcone.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from './Historico.module.css';

export default function Historico() {
  const { pessoas } = useAuth();
  const toast = useToast();
  const { registros: entradas, carregando: c1 } = useCrudMock('Entradas');
  const { registros: gastos, carregando: c2 } = useCrudMock('Gastos');
  const { registros: transferencias, carregando: c3 } = useCrudMock('Transferencias');

  const [dataReferencia, setDataReferencia] = useState(() => new Date());
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroPessoa, setFiltroPessoa] = useState('todos');
  const [busca, setBusca] = useState('');

  const carregando = c1 || c2 || c3;

  function mudarMes(deslocamento) {
    setDataReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + deslocamento, 1));
  }

  const mesAnoAlvo = `${dataReferencia.getFullYear()}-${String(dataReferencia.getMonth() + 1).padStart(2, '0')}`;

  const lancamentos = useMemo(() => {
    const todos = [
      ...entradas.map((e) => ({ ...e, tipo: 'entrada' })),
      ...gastos.map((g) => ({ ...g, tipo: 'gasto' })),
      ...transferencias.map((t) => ({ ...t, tipo: 'transferencia' })),
    ];

    return todos
      .filter((item) => obterMesAno(item.data) === mesAnoAlvo)
      .filter((item) => filtroTipo === 'todos' || item.tipo === filtroTipo)
      .filter((item) => filtroCategoria === 'todas' || item.categoria === filtroCategoria)
      .filter((item) => filtroPessoa === 'todos' || item.pessoa === filtroPessoa || item.pessoaOrigem === filtroPessoa || item.pessoaDestino === filtroPessoa)
      .filter((item) => !busca || item.descricao?.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [entradas, gastos, transferencias, mesAnoAlvo, filtroTipo, filtroCategoria, filtroPessoa, busca]);

  const totalEntradas = lancamentos.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
  const totalGastos = lancamentos.filter((l) => l.tipo === 'gasto').reduce((s, l) => s + Number(l.valor), 0);

  function dadosParaExportacao() {
    const linhas = lancamentos.map((item) => ({
      data: formatarData(item.data),
      tipo: item.tipo,
      descricao: item.descricao,
      categoria: item.categoria || '',
      pessoa: item.tipo === 'transferencia' ? `${item.pessoaOrigem} → ${item.pessoaDestino}` : item.pessoa || '',
      valor: item.valor,
    }));
    return {
      titulo: 'Sistema Financeiro Familiar',
      periodo: `Lançamentos de ${nomeMesAno(dataReferencia)}`,
      linhas,
      totalEntradas,
      totalGastos,
    };
  }

  async function aoExportarExcel() {
    try {
      await exportarExcel({ ...dadosParaExportacao(), nomeArquivo: `lancamentos-${mesAnoAlvo}.xlsx` });
    } catch {
      toast.erro('Não foi possível gerar o Excel. Tente novamente.');
    }
  }

  async function aoExportarPdf() {
    try {
      await exportarPdf({ ...dadosParaExportacao(), nomeArquivo: `lancamentos-${mesAnoAlvo}.pdf` });
    } catch {
      toast.erro('Não foi possível gerar o PDF. Tente novamente.');
    }
  }

  if (carregando) return <Loading texto="Carregando histórico..." />;

  return (
    <div>
      <div className={styles.navegacaoMes}>
        <button type="button" className={styles.botaoNav} onClick={() => mudarMes(-1)} aria-label="Mês anterior">
          <ChevronLeft size={18} />
        </button>
        <span className={styles.mesAtual}>{nomeMesAno(dataReferencia)}</span>
        <button type="button" className={styles.botaoNav} onClick={() => mudarMes(1)} aria-label="Próximo mês">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className={styles.filtros}>
        <Input
          icone={Search}
          placeholder="Buscar por descrição..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={styles.busca}
        />
        <Select className={styles.filtroSelect} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="entrada">Entradas</option>
          <option value="gasto">Gastos</option>
          <option value="transferencia">Transferências</option>
        </Select>
        <Select className={styles.filtroSelect} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="todas">Todas as categorias</option>
          {CATEGORIAS_ENTRADA_FIXAS.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
          {CATEGORIAS_GASTO_FIXAS.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </Select>
        <Select className={styles.filtroSelect} value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)}>
          <option value="todos">Todas as pessoas</option>
          {pessoas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.resumo}>
        <span>
          Entradas: <strong className="valor-positivo">{formatarMoeda(totalEntradas)}</strong>
        </span>
        <span>
          Gastos: <strong className="valor-negativo">{formatarMoeda(totalGastos)}</strong>
        </span>
        <span>
          {lancamentos.length} lançamento{lancamentos.length !== 1 ? 's' : ''}
        </span>
        <div className={styles.botoesExportar}>
          <Button
            variante="secundario"
            tamanho="pequeno"
            icone={FileSpreadsheet}
            onClick={aoExportarExcel}
            disabled={lancamentos.length === 0}
          >
            Excel
          </Button>
          <Button
            variante="secundario"
            tamanho="pequeno"
            icone={FileText}
            onClick={aoExportarPdf}
            disabled={lancamentos.length === 0}
          >
            PDF
          </Button>
        </div>
      </div>

      {lancamentos.length === 0 ? (
        <EmptyState icone={History} titulo="Nada neste período" descricao="Ajuste os filtros ou navegue para outro mês." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Pessoa</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((item) => (
              <tr key={`${item.tipo}-${item.id}`}>
                <td data-rotulo="Descrição">{item.descricao}</td>
                <td data-rotulo="Categoria">
                  <CategoriaComIcone nome={item.categoria} />
                </td>
                <td data-rotulo="Pessoa">
                  {item.tipo === 'transferencia' ? (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <Avatar nome={item.pessoaOrigem} tamanho="pequeno" /> → <Avatar nome={item.pessoaDestino} tamanho="pequeno" />
                    </span>
                  ) : item.pessoa ? (
                    <Avatar nome={item.pessoa} tamanho="pequeno" />
                  ) : (
                    '-'
                  )}
                </td>
                <td data-rotulo="Data">{formatarData(item.data)}</td>
                <td data-rotulo="Tipo">
                  <Badge cor={item.tipo === 'entrada' ? 'sucesso' : item.tipo === 'gasto' ? 'perigo' : 'info'}>
                    {item.tipo === 'entrada' ? 'Entrada' : item.tipo === 'gasto' ? 'Gasto' : 'Transferência'}
                  </Badge>
                </td>
                <TableColunaNumerica data-rotulo="Valor">
                  <span className={item.tipo === 'entrada' ? 'valor-positivo' : item.tipo === 'gasto' ? 'valor-negativo' : ''}>
                    {item.tipo === 'entrada' ? '+' : item.tipo === 'gasto' ? '-' : ''} {formatarMoeda(item.valor)}
                  </span>
                </TableColunaNumerica>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
