import { useRef, useState } from 'react';
import { Upload, FileUp, X, ShieldCheck, FileText, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Button, Select, Badge, EmptyState, InfoBanner, Table, TableColunaNumerica } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { criar } from '../../services/dados.js';
import { inferirCategoriaPorDescricao } from '../../utils/classificarTransacao.js';
import { formatarData, formatarMoeda, nomeExibicao } from '../../utils/formatadores.js';
import { useCategorias } from '../../contexts/CategoriasContext.jsx';
import formStyles from '../_shared/CrudPage.module.css';
import styles from './ImportarExtrato.module.css';

export default function ImportarExtrato() {
  const { registros: entradas } = useCrudMock('Entradas');
  const { registros: gastos } = useCrudMock('Gastos');
  const { categoriasGasto, categoriasEntrada, iconesGasto, iconesEntrada } = useCategorias();
  const { perfil, usuario } = useAuth();
  const toast = useToast();
  const inputArquivoRef = useRef(null);

  const [transacoes, setTransacoes] = useState([]);
  const [importando, setImportando] = useState(false);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [textoNaoReconhecido, setTextoNaoReconhecido] = useState('');

  const selecionadas = transacoes.filter((t) => t.selecionada);
  const totalDuplicados = transacoes.filter((t) => t.duplicado).length;
  const totalEntradas = transacoes.filter((t) => t.tipo === 'entrada').length;
  const totalGastos = transacoes.filter((t) => t.tipo === 'gasto').length;

  async function aoSelecionarArquivo(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    evento.target.value = '';

    setLendoArquivo(true);
    setTextoNaoReconhecido('');
    try {
      const { analisarPdf } = await import('../../utils/pdfExtrato.js');
      const { transacoes: brutas, linhas: linhasBrutas } = await analisarPdf(arquivo);

      if (brutas.length === 0) {
        toast.erro('Não conseguimos reconhecer nenhum lançamento nesse PDF. O layout desse extrato pode não ser suportado.');
        setTextoNaoReconhecido(linhasBrutas.filter((l) => l.trim()).join('\n'));
        return;
      }

      const existentes = [...entradas, ...gastos];
      const comMetadados = brutas.map((t) => {
        const duplicado = existentes.some((e) => e.data === t.data && Math.abs(Number(e.valor) - t.valor) < 0.01);
        const categoriaSugerida = inferirCategoriaPorDescricao(t.descricao, t.tipo) || '';
        return { ...t, categoria: categoriaSugerida, categoriaSugerida: Boolean(categoriaSugerida), selecionada: !duplicado, duplicado };
      });

      setTransacoes(comMetadados);
    } catch {
      toast.erro('Não foi possível ler esse arquivo. Tente novamente.');
    } finally {
      setLendoArquivo(false);
    }
  }

  function limpar() {
    setTransacoes([]);
    setTextoNaoReconhecido('');
  }

  function alternarSelecao(id) {
    setTransacoes((atual) => atual.map((t) => (t.id === id ? { ...t, selecionada: !t.selecionada } : t)));
  }

  function definirCategoria(id, categoria) {
    setTransacoes((atual) => atual.map((t) => (t.id === id ? { ...t, categoria, categoriaSugerida: false } : t)));
  }

  function definirTipo(id, tipo) {
    setTransacoes((atual) =>
      atual.map((t) => (t.id === id ? { ...t, tipo, categoria: '', categoriaSugerida: false, tipoIncerto: false } : t))
    );
  }

  function selecionarTodas(valor) {
    setTransacoes((atual) => atual.map((t) => ({ ...t, selecionada: valor })));
  }

  async function importarSelecionadas() {
    if (selecionadas.length === 0) {
      toast.erro('Selecione ao menos um lançamento pra importar.');
      return;
    }
    const semCategoria = selecionadas.find((t) => !t.categoria);
    if (semCategoria) {
      toast.erro('Escolha a categoria de todos os lançamentos selecionados.');
      return;
    }

    setImportando(true);
    const pessoa = nomeExibicao(perfil, usuario).split(' ')[0];
    const familiaId = perfil?.familia_id;

    try {
      for (const transacao of selecionadas) {
        const tabela = transacao.tipo === 'entrada' ? 'Entradas' : 'Gastos';
        await criar(
          tabela,
          {
            descricao: transacao.descricao,
            valor: transacao.valor,
            data: transacao.data,
            categoria: transacao.categoria,
            pessoa,
            ...(transacao.tipo === 'gasto' ? { cartao: '' } : {}),
          },
          familiaId
        );
      }
      toast.sucesso(`${selecionadas.length} lançamento(s) importado(s) com sucesso`);
      limpar();
    } catch {
      toast.erro('Algo deu errado ao importar. Os lançamentos já confirmados foram salvos — tente novamente pros restantes.');
    } finally {
      setImportando(false);
    }
  }

  return (
    <div>
      <div className={formStyles.cabecalhoPagina}>
        <Upload size={20} className={formStyles.iconePagina} />
        <h1>Importar Extrato</h1>
      </div>

      <InfoBanner>
        Exporte o extrato da sua conta em <strong>PDF</strong> no aplicativo/site do banco e anexe aqui. A leitura é
        experimental — confira cada linha com atenção antes de importar. Cartão de crédito ainda não é suportado por
        aqui — use a tela de Gastos ou o lançamento rápido para compras no cartão.
      </InfoBanner>

      <div className={styles.avisoSeguranca}>
        <ShieldCheck size={16} />
        Seus dados ficam seguros: o arquivo é lido aqui mesmo, no seu navegador — nada é enviado pra fora até você
        conferir e confirmar a importação.
      </div>

      {transacoes.length === 0 ? (
        <>
          <input
            ref={inputArquivoRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={aoSelecionarArquivo}
            className={styles.inputArquivo}
          />
          <EmptyState
            icone={FileUp}
            titulo="Nenhum arquivo selecionado"
            descricao="Escolha um arquivo .pdf exportado do seu banco pra ver os lançamentos encontrados."
            acao={
              <Button carregando={lendoArquivo} onClick={() => inputArquivoRef.current?.click()}>
                Escolher arquivo
              </Button>
            }
          />

          {textoNaoReconhecido && (
            <div className={styles.blocoDiagnostico}>
              <p className={styles.tituloDiagnostico}>
                Texto extraído do PDF (não reconhecemos nenhuma linha como lançamento). Copie e envie esse texto pra
                gente ajustar a leitura pro layout do seu banco:
              </p>
              <textarea readOnly value={textoNaoReconhecido} className={styles.areaDiagnostico} />
              <Button
                variante="secundario"
                tamanho="pequeno"
                onClick={() => {
                  navigator.clipboard.writeText(textoNaoReconhecido);
                  toast.sucesso('Texto copiado');
                }}
              >
                Copiar texto
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.resumo}>
            <div className={styles.resumoIcone}>
              <FileText size={20} />
            </div>
            <div className={styles.resumoTextos}>
              <p className={styles.tituloResumo}>Extrato PDF anexado</p>
              <div className={styles.contagem}>
                <span>{transacoes.length} lançamento(s)</span>
                <span className={styles.contagemEntrada}>
                  <TrendingUp size={13} /> {totalEntradas} entrada(s)
                </span>
                <span className={styles.contagemGasto}>
                  <TrendingDown size={13} /> {totalGastos} gasto(s)
                </span>
                {totalDuplicados > 0 && <span>{totalDuplicados} possível(is) duplicado(s) já desmarcado(s)</span>}
              </div>
            </div>
            <Button variante="secundario" tamanho="pequeno" className={styles.botaoTrocar} onClick={limpar}>
              <X size={16} /> Trocar arquivo
            </Button>
          </div>

          {totalDuplicados > 0 && (
            <div className={styles.avisoDuplicados}>
              <AlertTriangle size={20} />
              <div>
                <p className={styles.tituloAvisoDuplicados}>
                  {totalDuplicados === transacoes.length
                    ? 'Esse extrato parece já ter sido importado antes!'
                    : `${totalDuplicados} de ${transacoes.length} lançamentos já existem no seu histórico.`}
                </p>
                <p className={styles.textoAvisoDuplicados}>
                  Já desmarcamos os prováveis duplicados pra você — confira a lista abaixo com atenção antes de
                  importar, pra não lançar a mesma coisa duas vezes.
                </p>
              </div>
            </div>
          )}

          <div className={styles.acoesSelecao}>
            <button type="button" onClick={() => selecionarTodas(true)}>
              Selecionar todas
            </button>
            <button type="button" onClick={() => selecionarTodas(false)}>
              Desmarcar todas
            </button>
          </div>

          <Table>
            <thead>
              <tr>
                <th />
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.map((transacao) => {
                const opcoes = transacao.tipo === 'entrada' ? categoriasEntrada : categoriasGasto;
                const icones = transacao.tipo === 'entrada' ? iconesEntrada : iconesGasto;
                return (
                  <tr key={transacao.id} className={!transacao.selecionada ? styles.linhaDesmarcada : ''}>
                    <td data-rotulo="Importar">
                      <input
                        type="checkbox"
                        checked={transacao.selecionada}
                        onChange={() => alternarSelecao(transacao.id)}
                        aria-label="Importar este lançamento"
                      />
                    </td>
                    <td data-rotulo="Data">{formatarData(transacao.data)}</td>
                    <td data-rotulo="Descrição">
                      <div className={styles.celulaDescricao}>
                        <span>{transacao.descricao}</span>
                        {transacao.duplicado && <Badge cor="alerta">Possível duplicado</Badge>}
                      </div>
                    </td>
                    <td data-rotulo="Tipo">
                      <div className={styles.celulaCampo}>
                        <Select
                          aria-label="Tipo"
                          value={transacao.tipo}
                          onChange={(e) => definirTipo(transacao.id, e.target.value)}
                          className={styles.selectTipo}
                        >
                          <option value="entrada">Entrada</option>
                          <option value="gasto">Gasto</option>
                        </Select>
                        {transacao.tipoIncerto && <Badge cor="alerta">Confirme o tipo</Badge>}
                      </div>
                    </td>
                    <td data-rotulo="Categoria">
                      <div className={styles.celulaCampo}>
                        <Select
                          aria-label="Categoria"
                          icone={icones[transacao.categoria]}
                          value={transacao.categoria}
                          onChange={(e) => definirCategoria(transacao.id, e.target.value)}
                          className={styles.selectCategoria}
                        >
                          <option value="">Selecione</option>
                          {opcoes.map((nome) => (
                            <option key={nome} value={nome}>
                              {nome}
                            </option>
                          ))}
                        </Select>
                        {transacao.categoriaSugerida && <Badge cor="info">Sugerida</Badge>}
                      </div>
                    </td>
                    <TableColunaNumerica data-rotulo="Valor">
                      <span className={transacao.tipo === 'entrada' ? 'valor-positivo' : 'valor-negativo'}>
                        {transacao.tipo === 'entrada' ? '+' : '-'} {formatarMoeda(transacao.valor)}
                      </span>
                    </TableColunaNumerica>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <div className={styles.rodape}>
            <Button carregando={importando} onClick={importarSelecionadas} className={styles.botaoImportar}>
              Importar {selecionadas.length} lançamento(s)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
