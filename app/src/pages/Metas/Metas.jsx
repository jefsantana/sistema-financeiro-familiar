import { useState } from 'react';
import { Trash2, Pencil, X, Check, Target } from 'lucide-react';
import { Input, Button, Card, ProgressBar, EmptyState, ConfirmDialog, SkeletonCard } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { formatarMoeda, parseValorMonetario, mascaraMoeda } from '../../utils/formatadores.js';
import formStyles from '../_shared/CrudPage.module.css';
import styles from './Metas.module.css';

const CAMPOS_VAZIOS = { descricao: '', valorAlvo: '', valorAtual: '' };

function valoresDaMeta(meta) {
  return {
    descricao: meta.descricao,
    valorAlvo: Number(meta.valorAlvo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    valorAtual: Number(meta.valorAtual).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}

export default function Metas() {
  const { registros: metas, carregando, salvando, salvar, editar, remover } = useCrudMock('Metas');
  const [camposNovo, setCamposNovo] = useState(CAMPOS_VAZIOS);
  const [edicao, setEdicao] = useState(null);
  const [paraExcluir, setParaExcluir] = useState(null);
  const toast = useToast();

  function atualizarCampoNovo(nome, valor) {
    const ehMoeda = nome === 'valorAlvo' || nome === 'valorAtual';
    setCamposNovo((atual) => ({ ...atual, [nome]: ehMoeda ? mascaraMoeda(valor) : valor }));
  }

  function atualizarCampoEdicao(nome, valor) {
    const ehMoeda = nome === 'valorAlvo' || nome === 'valorAtual';
    setEdicao((atual) => ({ ...atual, valores: { ...atual.valores, [nome]: ehMoeda ? mascaraMoeda(valor) : valor } }));
  }

  function iniciarEdicao(meta) {
    setEdicao({ id: meta.id, valores: valoresDaMeta(meta) });
  }

  function cancelarEdicao() {
    setEdicao(null);
  }

  async function aoCriar(evento) {
    evento.preventDefault();

    if (parseValorMonetario(camposNovo.valorAlvo) <= 0) {
      toast.erro('Informe um valor alvo maior que zero.');
      return;
    }

    try {
      await salvar({
        descricao: camposNovo.descricao,
        valorAlvo: parseValorMonetario(camposNovo.valorAlvo),
        valorAtual: parseValorMonetario(camposNovo.valorAtual),
      });
      toast.sucesso('Meta salva com sucesso');
    } catch {
      return;
    }
    setCamposNovo(CAMPOS_VAZIOS);
  }

  async function salvarEdicao() {
    if (parseValorMonetario(edicao.valores.valorAlvo) <= 0) {
      toast.erro('Informe um valor alvo maior que zero.');
      return;
    }

    try {
      await editar(edicao.id, {
        descricao: edicao.valores.descricao,
        valorAlvo: parseValorMonetario(edicao.valores.valorAlvo),
        valorAtual: parseValorMonetario(edicao.valores.valorAtual),
      });
      toast.sucesso('Alterações salvas com sucesso');
    } catch {
      return;
    }
    setEdicao(null);
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
        <h1>Nova Meta</h1>
      </div>

      <form onSubmit={aoCriar} className={formStyles.formulario}>
        <Input
          rotulo="Descrição"
          required
          placeholder="Ex: Viagem"
          value={camposNovo.descricao}
          onChange={(e) => atualizarCampoNovo('descricao', e.target.value)}
          className={formStyles.campoFlex}
        />
        <Input
          rotulo="Valor alvo (R$)"
          required
          inputMode="decimal"
          placeholder="0,00"
          value={camposNovo.valorAlvo}
          onChange={(e) => atualizarCampoNovo('valorAlvo', e.target.value)}
          className={formStyles.campoFlex}
        />
        <Input
          rotulo="Valor já guardado (R$)"
          required
          inputMode="decimal"
          placeholder="0,00"
          value={camposNovo.valorAtual}
          onChange={(e) => atualizarCampoNovo('valorAtual', e.target.value)}
          className={formStyles.campoFlex}
        />
        <div className={formStyles.acoesFormulario}>
          <Button type="submit" carregando={salvando} className={formStyles.botaoSalvar}>
            Salvar Meta
          </Button>
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
            const emEdicao = edicao?.id === meta.id;
            const percentual = Math.min(100, Math.round((Number(meta.valorAtual) / Number(meta.valorAlvo)) * 100));
            return (
              <Card key={meta.id} className={styles.card}>
                <div className={styles.acoesCard}>
                  {emEdicao ? (
                    <>
                      <button type="button" onClick={salvarEdicao} aria-label="Salvar meta" style={{ color: 'var(--cor-sucesso)' }}>
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicao}
                        aria-label="Cancelar edição"
                        style={{ color: 'var(--cor-texto-secundario)' }}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(meta)}
                        aria-label="Editar meta"
                        disabled={Boolean(edicao)}
                        style={{ color: 'var(--cor-texto-secundario)' }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setParaExcluir(meta.id)}
                        aria-label="Excluir meta"
                        disabled={Boolean(edicao)}
                        style={{ color: 'var(--cor-texto-secundario)' }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>

                {emEdicao ? (
                  <div className={styles.formEdicao}>
                    <Input
                      aria-label="Descrição"
                      value={edicao.valores.descricao}
                      onChange={(e) => atualizarCampoEdicao('descricao', e.target.value)}
                    />
                    <Input
                      aria-label="Valor alvo"
                      inputMode="decimal"
                      placeholder="Valor alvo (R$)"
                      value={edicao.valores.valorAlvo}
                      onChange={(e) => atualizarCampoEdicao('valorAlvo', e.target.value)}
                    />
                    <Input
                      aria-label="Valor já guardado"
                      inputMode="decimal"
                      placeholder="Valor guardado (R$)"
                      value={edicao.valores.valorAtual}
                      onChange={(e) => atualizarCampoEdicao('valorAtual', e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <p className={styles.descricao}>{meta.descricao}</p>
                    <p className={styles.valores}>
                      {formatarMoeda(meta.valorAtual)} de {formatarMoeda(meta.valorAlvo)}{' '}
                      <span className={styles.percentual}>({percentual}%)</span>
                    </p>
                    <ProgressBar percentual={percentual} cor="sucesso" />
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
        titulo="Excluir meta?"
        mensagem="A meta vai para a Lixeira e pode ser restaurada a qualquer momento."
        textoConfirmar="Excluir"
      />
    </div>
  );
}
