import { useRef, useState } from 'react';
import { Upload, FileUp, X } from 'lucide-react';
import { Button, Select, Badge, EmptyState, InfoBanner, Table, TableColunaNumerica } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { criar } from '../../services/dados.js';
import { analisarOfx } from '../../utils/ofx.js';
import { formatarData, formatarMoeda, nomeExibicao } from '../../utils/formatadores.js';
import { CATEGORIAS_GASTO_FIXAS, CATEGORIAS_ENTRADA_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO, ICONES_CATEGORIA_ENTRADA } from '../../utils/icones.js';
import formStyles from '../_shared/CrudPage.module.css';
import styles from './ImportarExtrato.module.css';

export default function ImportarExtrato() {
  const { registros: entradas } = useCrudMock('Entradas');
  const { registros: gastos } = useCrudMock('Gastos');
  const { perfil, usuario } = useAuth();
  const toast = useToast();
  const inputArquivoRef = useRef(null);

  const [nomeArquivo, setNomeArquivo] = useState('');
  const [origemPdf, setOrigemPdf] = useState(false);
  const [transacoes, setTransacoes] = useState([]);
  const [importando, setImportando] = useState(false);
  const [lendoArquivo, setLendoArquivo] = useState(false);

  const selecionadas = transacoes.filter((t) => t.selecionada);
  const totalDuplicados = transacoes.filter((t) => t.duplicado).length;

  async function aoSelecionarArquivo(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    evento.target.value = '';

    const ehPdf = arquivo.name.toLowerCase().endsWith('.pdf');
    setLendoArquivo(true);
    try {
      let brutas;
      if (ehPdf) {
        const { analisarPdf } = await import('../../utils/pdfExtrato.js');
        brutas = await analisarPdf(arquivo);
      } else {
        const texto = await arquivo.text();
        brutas = analisarOfx(texto);
      }

      if (brutas.length === 0) {
        toast.erro(
          ehPdf
            ? 'Não conseguimos reconhecer nenhum lançamento nesse PDF. O layout desse extrato pode não ser suportado.'
            : 'Não encontramos transações nesse arquivo. Confira se é um extrato OFX válido.'
        );
        return;
      }

      const existentes = [...entradas, ...gastos];
      const comMetadados = brutas.map((t) => {
        const duplicado = existentes.some((e) => e.data === t.data && Math.abs(Number(e.valor) - t.valor) < 0.01);
        return { ...t, categoria: '', selecionada: !duplicado, duplicado };
      });

      setTransacoes(comMetadados);
      setNomeArquivo(arquivo.name);
      setOrigemPdf(ehPdf);
    } catch {
      toast.erro('Não foi possível ler esse arquivo. Tente novamente ou exporte em outro formato.');
    } finally {
      setLendoArquivo(false);
    }
  }

  function limpar() {
    setTransacoes([]);
    setNomeArquivo('');
    setOrigemPdf(false);
  }

  function alternarSelecao(id) {
    setTransacoes((atual) => atual.map((t) => (t.id === id ? { ...t, selecionada: !t.selecionada } : t)));
  }

  function definirCategoria(id, categoria) {
    setTransacoes((atual) => atual.map((t) => (t.id === id ? { ...t, categoria } : t)));
  }

  function definirTipo(id, tipo) {
    setTransacoes((atual) => atual.map((t) => (t.id === id ? { ...t, tipo, categoria: '' } : t)));
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
        Exporte o extrato da sua conta no aplicativo/site do banco no formato <strong>OFX</strong> (mais confiável) ou{' '}
        <strong>PDF</strong> (leitura experimental — confira cada linha com atenção) e anexe aqui. Cartão de crédito
        ainda não é suportado por aqui — use a tela de Gastos ou o lançamento rápido para compras no cartão. O
        lançamento manual continua funcionando normalmente.
      </InfoBanner>

      {transacoes.length === 0 ? (
        <>
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".ofx,.qfx,.pdf"
            onChange={aoSelecionarArquivo}
            className={styles.inputArquivo}
          />
          <EmptyState
            icone={FileUp}
            titulo="Nenhum arquivo selecionado"
            descricao="Escolha um arquivo .ofx ou .pdf exportado do seu banco pra ver os lançamentos encontrados."
            acao={
              <Button carregando={lendoArquivo} onClick={() => inputArquivoRef.current?.click()}>
                Escolher arquivo
              </Button>
            }
          />
        </>
      ) : (
        <>
          {origemPdf && (
            <InfoBanner>
              Leitura de PDF é experimental: confira com atenção se a data, a descrição e o valor de cada linha vieram
              corretos antes de importar.
            </InfoBanner>
          )}

          <div className={styles.resumo}>
            <div>
              <p className={styles.nomeArquivo}>{nomeArquivo}</p>
              <p className={styles.contagem}>
                {transacoes.length} lançamento(s) encontrado(s)
                {totalDuplicados > 0 && ` · ${totalDuplicados} possível(is) duplicado(s) já desmarcado(s)`}
              </p>
            </div>
            <Button variante="secundario" tamanho="pequeno" onClick={limpar}>
              <X size={16} /> Trocar arquivo
            </Button>
          </div>

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
                const opcoes = transacao.tipo === 'entrada' ? CATEGORIAS_ENTRADA_FIXAS : CATEGORIAS_GASTO_FIXAS;
                const icones = transacao.tipo === 'entrada' ? ICONES_CATEGORIA_ENTRADA : ICONES_CATEGORIA_GASTO;
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
                      {transacao.descricao}
                      {transacao.duplicado && (
                        <Badge cor="alerta" className={styles.badgeDuplicado}>
                          Possível duplicado
                        </Badge>
                      )}
                    </td>
                    <td data-rotulo="Tipo">
                      <Select
                        aria-label="Tipo"
                        value={transacao.tipo}
                        onChange={(e) => definirTipo(transacao.id, e.target.value)}
                        className={styles.selectTipo}
                      >
                        <option value="entrada">Entrada</option>
                        <option value="gasto">Gasto</option>
                      </Select>
                    </td>
                    <td data-rotulo="Categoria">
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
            <Button carregando={importando} onClick={importarSelecionadas}>
              Importar {selecionadas.length} lançamento(s)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
