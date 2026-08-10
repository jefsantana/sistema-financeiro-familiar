import { useState } from 'react';
import { Trash2, Pencil, X, Target } from 'lucide-react';
import { Input, Button, Card, ProgressBar, EmptyState, ConfirmDialog, SkeletonCard } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { formatarMoeda, parseValorMonetario, mascaraMoeda } from '../../utils/formatadores.js';
import formStyles from '../_shared/CrudPage.module.css';
import styles from './Metas.module.css';

const CAMPOS_VAZIOS = { descricao: '', valorAlvo: '', valorAtual: '' };

export default function Metas() {
  const { registros: metas, carregando, salvando, salvar, editar, remover } = useCrudMock('Metas');
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [editandoId, setEditandoId] = useState(null);
  const [paraExcluir, setParaExcluir] = useState(null);
  const toast = useToast();

  function atualizarCampo(nome, valor) {
    const ehMoeda = nome === 'valorAlvo' || nome === 'valorAtual';
    setCampos((atual) => ({ ...atual, [nome]: ehMoeda ? mascaraMoeda(valor) : valor }));
  }

  function iniciarEdicao(meta) {
    setEditandoId(meta.id);
    setCampos({
      descricao: meta.descricao,
      valorAlvo: Number(meta.valorAlvo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      valorAtual: Number(meta.valorAtual).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setCampos(CAMPOS_VAZIOS);
  }

  async function aoSalvar(evento) {
    evento.preventDefault();

    if (parseValorMonetario(campos.valorAlvo) <= 0) {
      toast.erro('Informe um valor alvo maior que zero.');
      return;
    }

    const dados = {
      descricao: campos.descricao,
      valorAlvo: parseValorMonetario(campos.valorAlvo),
      valorAtual: parseValorMonetario(campos.valorAtual),
    };

    try {
      if (editandoId) {
        await editar(editandoId, dados);
        toast.sucesso('Alterações salvas com sucesso');
      } else {
        await salvar(dados);
        toast.sucesso('Meta salva com sucesso');
      }
    } catch {
      return;
    }
    setEditandoId(null);
    setCampos(CAMPOS_VAZIOS);
  }

  async function confirmarExclusao() {
    try {
      await remover(paraExcluir);
      toast.sucesso('Meta movida para a lixeira');
    } catch {
      // erro já sinalizado pelo hook useCrudMock
    }
  }

  return (
    <div>
      <div className={formStyles.cabecalhoPagina}>
        <Target size={20} className={formStyles.iconePagina} />
        <h1>{editandoId ? 'Editando meta' : 'Nova Meta'}</h1>
      </div>

      <form onSubmit={aoSalvar} className={formStyles.formulario}>
        <Input
          rotulo="Descrição"
          required
          placeholder="Ex: Viagem"
          value={campos.descricao}
          onChange={(e) => atualizarCampo('descricao', e.target.value)}
          className={formStyles.campoFlex}
        />
        <Input
          rotulo="Valor alvo (R$)"
          required
          inputMode="decimal"
          placeholder="0,00"
          value={campos.valorAlvo}
          onChange={(e) => atualizarCampo('valorAlvo', e.target.value)}
          className={formStyles.campoFlex}
        />
        <Input
          rotulo="Valor já guardado (R$)"
          required
          inputMode="decimal"
          placeholder="0,00"
          value={campos.valorAtual}
          onChange={(e) => atualizarCampo('valorAtual', e.target.value)}
          className={formStyles.campoFlex}
        />
        <div className={formStyles.acoesFormulario}>
          <Button type="submit" carregando={salvando} className={formStyles.botaoSalvar}>
            {editandoId ? 'Salvar alterações' : 'Salvar Meta'}
          </Button>
          {editandoId && (
            <Button type="button" variante="secundario" onClick={cancelarEdicao}>
              <X size={16} /> Cancelar
            </Button>
          )}
        </div>
      </form>

      <h3 className={formStyles.tituloLista}>Metas cadastradas</h3>

      {carregando ? (
        <div className={styles.grade}>
          <Card><SkeletonCard /></Card>
          <Card><SkeletonCard /></Card>
        </div>
      ) : metas.length === 0 ? (
        <EmptyState icone={Target} titulo="Nenhuma meta ainda" descricao="Cadastre a primeira meta usando o formulário acima." />
      ) : (
        <div className={styles.grade}>
          {metas.map((meta) => {
            const percentual = Math.min(100, Math.round((Number(meta.valorAtual) / Number(meta.valorAlvo)) * 100));
            return (
              <Card key={meta.id} className={styles.card}>
                <div className={styles.acoesCard}>
                  <button
                    type="button"
                    onClick={() => iniciarEdicao(meta)}
                    aria-label="Editar meta"
                    style={{ color: 'var(--cor-texto-secundario)' }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setParaExcluir(meta.id)}
                    aria-label="Excluir meta"
                    style={{ color: 'var(--cor-texto-secundario)' }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <p className={styles.descricao}>{meta.descricao}</p>
                <p className={styles.valores}>
                  {formatarMoeda(meta.valorAtual)} de {formatarMoeda(meta.valorAlvo)}{' '}
                  <span className={styles.percentual}>({percentual}%)</span>
                </p>
                <ProgressBar percentual={percentual} cor="sucesso" />
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        aberto={Boolean(paraExcluir)}
        aoFechar={() => setParaExcluir(null)}
        aoConfirmar={confirmarExclusao}
        titulo="Excluir meta?"
        mensagem="A meta vai para a Lixeira e pode ser restaurada a qualquer momento."
        textoConfirmar="Excluir"
      />
    </div>
  );
}
