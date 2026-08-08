import { useMemo, useState } from 'react';
import { Wallet, Pencil, Trash2, X } from 'lucide-react';
import { Card, Button, Select, Input, ProgressBar, ConfirmDialog, EmptyState } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CATEGORIAS_GASTO_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO } from '../../utils/icones.js';
import { formatarMoeda, parseValorMonetario, nomeExibicao } from '../../utils/formatadores.js';
import { mesAnoDe, obterMesAno } from '../../utils/financeiro.js';
import stylesForm from '../_shared/CrudPage.module.css';
import styles from './Orcamentos.module.css';

export default function Orcamentos() {
  const { registros: orcamentos, carregando, salvando, salvar, editar, remover } = useCrudMock('Orcamentos');
  const { registros: gastos, carregando: carregandoGastos } = useCrudMock('Gastos');
  const { perfil, usuario } = useAuth();
  const toast = useToast();

  const [categoria, setCategoria] = useState('');
  const [limite, setLimite] = useState('');
  const [editando, setEditando] = useState(null);
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

  const categoriasDisponiveis = CATEGORIAS_GASTO_FIXAS.filter(
    (nome) => nome === editando?.categoria || !orcamentos.some((o) => o.categoria === nome)
  );

  function limparFormulario() {
    setCategoria('');
    setLimite('');
    setEditando(null);
  }

  function iniciarEdicao(orcamento) {
    setEditando(orcamento);
    setCategoria(orcamento.categoria);
    setLimite(Number(orcamento.limiteMensal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  async function aoSalvar(evento) {
    evento.preventDefault();
    if (!categoria) {
      toast.erro('Escolha uma categoria.');
      return;
    }
    if (parseValorMonetario(limite) <= 0) {
      toast.erro('Informe um limite maior que zero.');
      return;
    }

    if (editando) {
      await editar(editando.id, { categoria, limiteMensal: parseValorMonetario(limite) });
      toast.sucesso('Orçamento atualizado');
    } else {
      await salvar({ categoria, limiteMensal: parseValorMonetario(limite) });
      toast.sucesso('Orçamento criado');
    }
    limparFormulario();
  }

  async function confirmarExclusao() {
    await remover(paraExcluir, nomeExibicao(perfil, usuario).split(' ')[0]);
    toast.sucesso('Orçamento movido para a lixeira');
  }

  return (
    <div>
      <div className={stylesForm.cabecalhoPagina}>
        <Wallet size={20} className={stylesForm.iconePagina} />
        <h1>{editando ? 'Editando orçamento' : 'Novo Orçamento'}</h1>
      </div>

      <form className={stylesForm.formulario} onSubmit={aoSalvar} noValidate>
        <Select
          rotulo="Categoria"
          required
          icone={ICONES_CATEGORIA_GASTO[categoria]}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className={stylesForm.campoFlex}
        >
          <option value="">Selecione</option>
          {categoriasDisponiveis.map((nome) => (
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
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
          className={stylesForm.campoFlex}
        />
        <div className={stylesForm.acoesFormulario}>
          <Button type="submit" carregando={salvando}>
            {editando ? 'Salvar alterações' : 'Salvar'}
          </Button>
          {editando && (
            <Button type="button" variante="secundario" onClick={limparFormulario}>
              <X size={16} /> Cancelar
            </Button>
          )}
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
            const Icone = ICONES_CATEGORIA_GASTO[orcamento.categoria];
            const gasto = gastoPorCategoria[orcamento.categoria] || 0;
            const limiteNum = Number(orcamento.limiteMensal);
            const percentual = limiteNum > 0 ? Math.round((gasto / limiteNum) * 100) : 0;
            const estourou = percentual > 100;

            return (
              <Card key={orcamento.id} className={styles.item}>
                <div className={styles.linhaTopo}>
                  <span className={styles.categoria}>
                    {Icone && <Icone size={16} />}
                    {orcamento.categoria}
                  </span>
                  <div className={styles.acoesItem}>
                    <button type="button" onClick={() => iniciarEdicao(orcamento)} title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => setParaExcluir(orcamento.id)} title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className={styles.valores}>
                  <span className={estourou ? styles.estourado : ''}>
                    {formatarMoeda(gasto)} de {formatarMoeda(limiteNum)}
                  </span>
                  <span>{percentual}%</span>
                </div>
                <ProgressBar percentual={percentual} cor={estourou ? 'perigo' : percentual > 80 ? 'alerta' : 'primaria'} />
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
