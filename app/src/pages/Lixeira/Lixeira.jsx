import { useEffect, useRef, useState } from 'react';
import { Trash2, RotateCcw, X, Clock, Save } from 'lucide-react';
import { Badge, Table, TableColunaAcoes, TableBotaoAcao, EmptyState, Loading, ConfirmDialog, Card, Input, Button } from '../../components/ui/index.js';
import { useLixeira } from '../../hooks/useLixeira.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { formatarData } from '../../utils/formatadores.js';
import styles from './Lixeira.module.css';

const TEXTO_CONFIRMACAO_ESVAZIAR = 'ESVAZIAR';

function nomeExibicao(item) {
  if (item.descricao) return item.descricao;
  if (item.nome) return item.nome;
  if (item.mesAno) return `Pagamento de ${item.mesAno}`;
  if (item.categoria) return item.categoria;
  return 'Registro sem descrição';
}

export default function Lixeira() {
  const { itens, carregando, restaurarItem, excluirItemPermanente } = useLixeira();
  const { familia, atualizarDiasRetencaoLixeira } = useAuth();
  const [paraExcluirDefinitivo, setParaExcluirDefinitivo] = useState(null);
  const [esvaziarAberto, setEsvaziarAberto] = useState(false);
  const [textoEsvaziar, setTextoEsvaziar] = useState('');
  const toast = useToast();

  const diasRetencao = familia?.dias_retencao_lixeira ?? 30;
  const [diasInput, setDiasInput] = useState(diasRetencao);
  const [salvandoDias, setSalvandoDias] = useState(false);
  useEffect(() => setDiasInput(diasRetencao), [diasRetencao]);

  const purgandoRef = useRef(false);

  useEffect(() => {
    if (carregando || purgandoRef.current) return;

    const corte = new Date();
    corte.setDate(corte.getDate() - diasRetencao);
    const antigos = itens.filter((item) => new Date(item.excluidoEm) < corte);
    if (antigos.length === 0) return;

    purgandoRef.current = true;
    (async () => {
      for (const item of antigos) {
        await excluirItemPermanente(item._tabela, item.id).catch(() => {});
      }
      toast.sucesso(
        `${antigos.length} item(ns) apagado(s) automaticamente por estarem há mais de ${diasRetencao} dias na lixeira`
      );
      purgandoRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, carregando, diasRetencao]);

  async function aoRestaurar(item) {
    await restaurarItem(item._tabela, item.id);
    toast.sucesso(`"${nomeExibicao(item)}" foi restaurado`);
  }

  async function confirmarExclusaoDefinitiva() {
    await excluirItemPermanente(paraExcluirDefinitivo._tabela, paraExcluirDefinitivo.id);
    toast.sucesso('Registro excluído definitivamente');
  }

  async function salvarDiasRetencao() {
    const dias = Number(diasInput);
    if (!dias || dias < 1) {
      toast.erro('Informe um número de dias maior que zero.');
      return;
    }
    setSalvandoDias(true);
    const { error } = await atualizarDiasRetencaoLixeira(dias);
    setSalvandoDias(false);
    if (error) {
      toast.erro('Não foi possível salvar. Tente novamente.');
      return;
    }
    toast.sucesso('Configuração salva');
  }

  async function confirmarEsvaziar() {
    for (const item of itens) {
      await excluirItemPermanente(item._tabela, item.id).catch(() => {});
    }
    toast.sucesso('Lixeira esvaziada');
    setTextoEsvaziar('');
  }

  if (carregando) return <Loading texto="Carregando lixeira..." />;

  return (
    <div>
      <h1
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontFamily: 'var(--fonte-display)',
          fontSize: '1.2rem',
          fontWeight: 600,
          marginBottom: 'var(--espaco-md)',
        }}
      >
        <Trash2 size={20} style={{ color: 'var(--cor-primaria)' }} /> Lixeira
      </h1>

      <Card className={styles.cardConfig}>
        <div className={styles.linhaConfig}>
          <div className={styles.blocoRetencao}>
            <div className={styles.iconeRetencao}>
              <Clock size={16} />
            </div>
            <div>
              <p className={styles.rotuloConfig}>Excluir itens automaticamente</p>
              <p className={styles.descricaoConfig}>
                Itens que ficam na lixeira por mais tempo que isso são apagados para sempre sozinhos, sempre que você
                abre esta tela.
              </p>
            </div>
          </div>
          <div className={styles.entradaDias}>
            <Input
              type="number"
              min={1}
              value={diasInput}
              onChange={(e) => setDiasInput(e.target.value)}
              className={styles.campoDias}
            />
            <span className={styles.sufixoDias}>dias</span>
            <Button tamanho="pequeno" icone={Save} carregando={salvandoDias} onClick={salvarDiasRetencao}>
              Salvar
            </Button>
          </div>
        </div>

        {itens.length > 0 && (
          <div className={styles.linhaEsvaziar}>
            <Button variante="perigo" tamanho="pequeno" icone={Trash2} onClick={() => setEsvaziarAberto(true)}>
              Esvaziar lixeira
            </Button>
          </div>
        )}
      </Card>

      {itens.length === 0 ? (
        <EmptyState icone={Trash2} titulo="Lixeira vazia" descricao="Itens excluídos aparecem aqui e podem ser restaurados a qualquer momento." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Excluído em</th>
              <th>Por</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={`${item._tabela}-${item.id}`}>
                <td data-rotulo="Descrição">{nomeExibicao(item)}</td>
                <td data-rotulo="Tipo">
                  <Badge cor="neutro">{item._tipoLabel}</Badge>
                </td>
                <td data-rotulo="Excluído em">{formatarData(item.excluidoEm)}</td>
                <td data-rotulo="Por">{item.excluidoPor || '-'}</td>
                <TableColunaAcoes>
                  <TableBotaoAcao title="Restaurar" rotulo="Restaurar" onClick={() => aoRestaurar(item)}>
                    <RotateCcw size={16} />
                  </TableBotaoAcao>
                  <TableBotaoAcao title="Excluir definitivamente" rotulo="Excluir" onClick={() => setParaExcluirDefinitivo(item)}>
                    <X size={16} />
                  </TableBotaoAcao>
                </TableColunaAcoes>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        aberto={Boolean(paraExcluirDefinitivo)}
        aoFechar={() => setParaExcluirDefinitivo(null)}
        aoConfirmar={confirmarExclusaoDefinitiva}
        titulo="Excluir definitivamente?"
        mensagem="Essa ação não pode ser desfeita. O registro será apagado para sempre."
        textoConfirmar="Excluir para sempre"
      />

      <ConfirmDialog
        aberto={esvaziarAberto}
        aoFechar={() => {
          setEsvaziarAberto(false);
          setTextoEsvaziar('');
        }}
        aoConfirmar={confirmarEsvaziar}
        titulo="Esvaziar a lixeira?"
        mensagem={`Essa ação não pode ser desfeita. Todos os ${itens.length} item(ns) da lixeira serão apagados para sempre.`}
        textoConfirmar="Esvaziar lixeira"
        confirmarDesabilitado={textoEsvaziar.trim().toUpperCase() !== TEXTO_CONFIRMACAO_ESVAZIAR}
      >
        <Input
          rotulo={`Para confirmar, digite "${TEXTO_CONFIRMACAO_ESVAZIAR}"`}
          value={textoEsvaziar}
          onChange={(e) => setTextoEsvaziar(e.target.value)}
          placeholder={TEXTO_CONFIRMACAO_ESVAZIAR}
        />
      </ConfirmDialog>
    </div>
  );
}
