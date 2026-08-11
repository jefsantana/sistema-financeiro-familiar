import { useState } from 'react';
import { Tag, TrendingUp, Plus, Trash2, Lock } from 'lucide-react';
import { Card, Input, Button, ConfirmDialog } from '../../components/ui/index.js';
import { useCategorias } from '../../contexts/CategoriasContext.jsx';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { criar, excluir } from '../../services/dados.js';
import { nomeExibicao } from '../../utils/formatadores.js';
import { CATEGORIAS_GASTO_FIXAS, CATEGORIAS_ENTRADA_FIXAS } from '../../utils/constantes.js';
import { ICONES_DISPONIVEIS } from '../../utils/icones.js';
import styles from './Categorias.module.css';

function SeletorIcone({ valor, aoSelecionar }) {
  return (
    <div className={styles.seletorIcone}>
      {Object.entries(ICONES_DISPONIVEIS).map(([nome, Icone]) => (
        <button
          key={nome}
          type="button"
          className={`${styles.opcaoIcone} ${valor === nome ? styles.opcaoIconeAtiva : ''}`}
          onClick={() => aoSelecionar(nome)}
          title={nome}
          aria-pressed={valor === nome}
        >
          <Icone size={16} />
        </button>
      ))}
    </div>
  );
}

function SecaoCategorias({
  icone: IconeSecao,
  titulo,
  descricao,
  tipo,
  nomesFixos,
  customizadas,
  icones,
  emUso,
  aoAdicionar,
  aoPedirRemocao,
}) {
  const [nome, setNome] = useState('');
  const [iconeEscolhido, setIconeEscolhido] = useState('Tag');
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  async function aoSalvar(evento) {
    evento.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.erro('Digite um nome pra categoria.');
      return;
    }
    const jaExiste = [...nomesFixos, ...customizadas.map((c) => c.nome)].some(
      (c) => c.toLowerCase() === nomeLimpo.toLowerCase()
    );
    if (jaExiste) {
      toast.erro('Já existe uma categoria com esse nome.');
      return;
    }

    setSalvando(true);
    try {
      await aoAdicionar({ nome: nomeLimpo, tipo, icone: iconeEscolhido });
      setNome('');
      setIconeEscolhido('Tag');
      toast.sucesso('Categoria adicionada');
    } catch {
      toast.erro('Não foi possível adicionar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className={styles.secaoFixa}>
      <div className={styles.cabecalhoFixo}>
        <IconeSecao size={18} style={{ color: 'var(--cor-primaria)' }} />
        <div>
          <h2 className={styles.titulo}>{titulo}</h2>
          <p className={styles.descricao}>{descricao}</p>
        </div>
      </div>

      <div className={styles.grade}>
        {nomesFixos.map((nomeCat) => {
          const Icone = icones[nomeCat];
          return (
            <div key={nomeCat} className={styles.itemFixo}>
              <Icone size={16} className={styles.iconeItem} />
              <span className={styles.nomeItem}>{nomeCat}</span>
              <Lock size={12} className={styles.iconeCadeado} />
            </div>
          );
        })}

        {customizadas.map((cat) => {
          const Icone = icones[cat.nome];
          const bloqueada = emUso.has(cat.nome);
          return (
            <div key={cat.id} className={`${styles.itemFixo} ${styles.itemCustom}`}>
              <Icone size={16} className={styles.iconeItem} />
              <span className={styles.nomeItem}>{cat.nome}</span>
              <button
                type="button"
                className={styles.botaoRemover}
                onClick={() => aoPedirRemocao(cat, bloqueada)}
                title={bloqueada ? 'Em uso — não pode ser removida' : 'Remover categoria'}
                disabled={bloqueada}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <form className={styles.formAdicionar} onSubmit={aoSalvar}>
        <p className={styles.tituloAdicionar}>Adicionar categoria</p>
        <div className={styles.linhaAdicionar}>
          <Input
            placeholder="Nome da categoria"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={styles.campoNome}
          />
          <Button type="submit" tamanho="pequeno" icone={Plus} carregando={salvando}>
            Adicionar
          </Button>
        </div>
        <SeletorIcone valor={iconeEscolhido} aoSelecionar={setIconeEscolhido} />
      </form>
    </Card>
  );
}

export default function Categorias() {
  const { iconesGasto, iconesEntrada, customizadas, recarregar } = useCategorias();
  const { perfil, usuario } = useAuth();
  const toast = useToast();
  const pessoaLogada = nomeExibicao(perfil, usuario).split(' ')[0];

  const { registros: entradas } = useCrudMock('Entradas');
  const { registros: gastos } = useCrudMock('Gastos');
  const { registros: parcelamentos } = useCrudMock('Parcelamentos');
  const { registros: orcamentos } = useCrudMock('Orcamentos');
  const { registros: comprasCartao } = useCrudMock('ComprasCartao');

  const [paraRemover, setParaRemover] = useState(null);

  const emUso = new Set(
    [
      ...entradas.map((e) => e.categoria),
      ...gastos.map((g) => g.categoria),
      ...parcelamentos.map((p) => p.categoria),
      ...orcamentos.map((o) => o.categoria),
      ...comprasCartao.map((c) => c.categoria),
    ].filter(Boolean)
  );

  async function adicionarCategoria({ nome, tipo, icone }) {
    await criar('Categorias', { nome, tipo, icone }, perfil.familia_id);
    await recarregar();
  }

  function pedirRemocao(categoria, bloqueada) {
    if (bloqueada) {
      toast.erro('Essa categoria está em uso em algum lançamento — não dá pra remover.');
      return;
    }
    setParaRemover(categoria);
  }

  async function confirmarRemocao() {
    try {
      await excluir('Categorias', paraRemover.id, pessoaLogada);
      await recarregar();
      toast.sucesso('Categoria removida');
    } catch {
      toast.erro('Não foi possível remover. Tente novamente.');
    }
  }

  const customizadasGasto = customizadas.filter((c) => c.tipo === 'gasto');
  const customizadasEntrada = customizadas.filter((c) => c.tipo === 'entrada');

  return (
    <div>
      <SecaoCategorias
        icone={Tag}
        titulo="Categorias de gasto"
        descricao="As categorias fixas (com cadeado) não podem ser editadas. Adicione as suas próprias abaixo."
        tipo="gasto"
        nomesFixos={CATEGORIAS_GASTO_FIXAS}
        customizadas={customizadasGasto}
        icones={iconesGasto}
        emUso={emUso}
        aoAdicionar={adicionarCategoria}
        aoPedirRemocao={pedirRemocao}
      />

      <SecaoCategorias
        icone={TrendingUp}
        titulo="Categorias de entrada"
        descricao="As categorias fixas (com cadeado) não podem ser editadas. Adicione as suas próprias abaixo."
        tipo="entrada"
        nomesFixos={CATEGORIAS_ENTRADA_FIXAS}
        customizadas={customizadasEntrada}
        icones={iconesEntrada}
        emUso={emUso}
        aoAdicionar={adicionarCategoria}
        aoPedirRemocao={pedirRemocao}
      />

      <ConfirmDialog
        aberto={Boolean(paraRemover)}
        aoFechar={() => setParaRemover(null)}
        aoConfirmar={confirmarRemocao}
        titulo="Remover categoria?"
        mensagem={`"${paraRemover?.nome}" vai para a Lixeira e pode ser restaurada a qualquer momento.`}
        textoConfirmar="Remover"
      />
    </div>
  );
}
