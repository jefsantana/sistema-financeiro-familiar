import { useMemo, useState } from 'react';
import { Wallet, Pencil, Trash2, X, Check } from 'lucide-react';
import { Card, Button, Select, Input, ProgressBar, ConfirmDialog, EmptyState, TableBotaoAcao } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CATEGORIAS_GASTO_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO } from '../../utils/icones.js';
import { formatarMoeda, parseValorMonetario, mascaraMoeda, nomeExibicao } from '../../utils/formatadores.js';
import { mesAnoDe, obterMesAno } from '../../utils/financeiro.js';
import stylesForm from '../_shared/CrudPage.module.css';
import styles from './Orcamentos.module.css';

export default function Orcamentos() {
  const { registros: orcamentos, carregando, salvando, salvar, editar, remover } = useCrudMock('Orcamentos');
  const { registros: gastos, carregando: carregandoGastos } = useCrudMock('Gastos');
  const { perfil, usuario } = useAuth();
  const toast = useToast();

  const [categoriaNova, setCategoriaNova] = useState('');
  const [limiteNovo, setLimiteNovo] = useState('');
  const [edicao, setEdicao] = useState(null);
  const [paraExcluir, setParaExcluir] = useState(null);

  const mesAtual = mesAnoDe(new Date());
  const gastoPorCategoria = useMemo(() => {
    const mapa = {};
    gastos
      .filter((g) => obterMesAno(g.data) === mesAtual)
      .forEach((g) => {
        mapa[g.categoria] = (mapa[g.categoria] || 0) + Number(g.valor);
      });
    return mapa;
  }, [gastos, mesAtual]);

  const categoriasParaNovo = CATEGORIAS_GASTO_FIXAS.filter((nome) => !orcamentos.some((o) => o.categoria === nome));

  function limparFormularioNovo() {
    setCategoriaNova('');
    setLimiteNovo('');
  }

  function iniciarEdicao(orcamento) {
    setEdicao({
      id: orcamento.id,
      categoria: orcamento.categoria,
      limite: Number(orcamento.limiteMensal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  }

  function cancelarEdicao() {
    setEdicao(null);
  }

  async function aoCriar(evento) {
    evento.preventDefault();
    if (!categoriaNova) {
      toast.erro('Escolha uma categoria.');
      return;
    }
    if (parseValorMonetario(limiteNovo) <= 0) {
      toast.erro('Informe um limite maior que zero.');
      return;
    }

    try {
      await salvar({ categoria: categoriaNova, limiteMensal: parseValorMonetario(limiteNovo) });
      toast.sucesso('Orçamento criado');
    } catch {
      return;
    }
    limparFormularioNovo();
  }

  async function salvarEdicao() {
    if (!edicao.categoria) {
      toast.erro('Escolha uma categoria.');
      return;
    }
    if (parseValorMonetario(edicao.limite) <= 0) {
      toast.erro('Informe um limite maior que zero.');
      return;
    }

    try {
      await editar(edicao.id, { categoria: edicao.categoria, limiteMensal: parseValorMonetario(edicao.limite) });
      toast.sucesso('Orçamento atualizado');
    } catch {
      return;
    }
    setEdicao(null);
  }

  async function confirmarExclusao() {
    try {
      await remover(paraExcluir, nomeExibicao(perfil, usuario).split(' ')[0]);
      toast.sucesso('Orçamento movido para a lixeira');
    } catch {
      // erro já sinalizado pelo hook useCrudMock
    }
  }

  return (
    <div>
      <div className={stylesForm.cabecalhoPagina}>
        <Wallet size={20} className={stylesForm.iconePagina} />
        <h1>Novo Orçamento</h1>
      </div>

      <form className={stylesForm.formulario} onSubmit={aoCriar} noValidate>
        <Select
          rotulo="Categoria"
          required
          icone={ICONES_CATEGORIA_GASTO[categoriaNova]}
          value={categoriaNova}
          onChange={(e) => setCategoriaNova(e.target.value)}
          className={stylesForm.campoFlex}
        >
          <option value="">Selecione</option>
          {categoriasParaNovo.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </Select>
        <Input
          rotulo="Limite mensal (R$)"
          required
          inputMode="decimal"
          placeholder="0,00"
          value={limiteNovo}
          onChange={(e) => setLimiteNovo(mascaraMoeda(e.target.value))}
          className={stylesForm.campoFlex}
        />
        <div className={stylesForm.acoesFormulario}>
          <Button type="submit" carregando={salvando}>
            Salvar
          </Button>
        </div>
      </form>

      <h3 className={stylesForm.tituloLista}>Orçamentos deste mês</h3>

      {!carregando && !carregandoGastos && orcamentos.length === 0 ? (
        <EmptyState
          icone={Wallet}
          titulo="Nenhum orçamento definido"
          descricao="Defina um limite mensal por categoria usando o formulário acima."
        />
      ) : (
        <div className={styles.lista}>
          {orcamentos.map((orcamento) => {
            const emEdicao = edicao?.id === orcamento.id;
            const Icone = ICONES_CATEGORIA_GASTO[orcamento.categoria];
            const gasto = gastoPorCategoria[orcamento.categoria] || 0;
            const limiteNum = Number(orcamento.limiteMensal);
            const percentual = limiteNum > 0 ? Math.round((gasto / limiteNum) * 100) : 0;
            const estourou = percentual > 100;
            const categoriasParaEdicao = CATEGORIAS_GASTO_FIXAS.filter(
              (nome) => nome === orcamento.categoria || !orcamentos.some((o) => o.categoria === nome)
            );

            return (
              <Card key={orcamento.id} className={styles.item}>
                <div className={styles.acoesItem}>
                  {emEdicao ? (
                    <>
                      <TableBotaoAcao title="Salvar" rotulo="Salvar" onClick={salvarEdicao}>
                        <Check size={16} />
                      </TableBotaoAcao>
                      <TableBotaoAcao title="Cancelar" rotulo="Cancelar" onClick={cancelarEdicao}>
                        <X size={16} />
                      </TableBotaoAcao>
                    </>
                  ) : (
                    <>
                      <TableBotaoAcao
                        title="Editar"
                        rotulo="Editar"
                        disabled={Boolean(edicao)}
                        onClick={() => iniciarEdicao(orcamento)}
                      >
                        <Pencil size={16} />
                      </TableBotaoAcao>
                      <TableBotaoAcao
                        title="Excluir"
                        rotulo="Excluir"
                        disabled={Boolean(edicao)}
                        onClick={() => setParaExcluir(orcamento.id)}
                      >
                        <Trash2 size={16} />
                      </TableBotaoAcao>
                    </>
                  )}
                </div>

                {!emEdicao && (
                  <div className={styles.linhaTopo}>
                    <span className={styles.categoria}>
                      {Icone && <Icone size={16} />}
                      {orcamento.categoria}
                    </span>
                  </div>
                )}

                {emEdicao ? (
                  <div className={styles.formEdicao}>
                    <Select
                      aria-label="Categoria"
                      icone={ICONES_CATEGORIA_GASTO[edicao.categoria]}
                      value={edicao.categoria}
                      onChange={(e) => setEdicao((atual) => ({ ...atual, categoria: e.target.value }))}
                    >
                      {categoriasParaEdicao.map((nome) => (
                        <option key={nome} value={nome}>
                          {nome}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label="Limite mensal"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={edicao.limite}
                      onChange={(e) => setEdicao((atual) => ({ ...atual, limite: mascaraMoeda(e.target.value) }))}
                    />
                  </div>
                ) : (
                  <>
                    <div className={styles.valores}>
                      <span className={estourou ? styles.estourado : ''}>
                        {formatarMoeda(gasto)} de {formatarMoeda(limiteNum)}
                      </span>
                      <span>{percentual}%</span>
                    </div>
                    <ProgressBar percentual={percentual} cor={estourou ? 'perigo' : percentual > 80 ? 'alerta' : 'primaria'} />
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        aberto={Boolean(paraExcluir)}
        aoFechar={() => setParaExcluir(null)}
        aoConfirmar={confirmarExclusao}
        titulo="Excluir orçamento?"
        mensagem="Isso remove o limite definido para essa categoria. Os gastos já lançados continuam normalmente."
        textoConfirmar="Excluir"
      />
    </div>
  );
}
