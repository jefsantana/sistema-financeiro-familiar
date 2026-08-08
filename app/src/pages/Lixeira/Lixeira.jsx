import { useState } from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { Badge, Table, TableColunaAcoes, TableBotaoAcao, EmptyState, Loading, ConfirmDialog } from '../../components/ui/index.js';
import { useLixeira } from '../../hooks/useLixeira.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { formatarData } from '../../utils/formatadores.js';

function nomeExibicao(item) {
  return item.descricao || item.nome || 'Registro sem descrição';
}

export default function Lixeira() {
  const { itens, carregando, restaurarItem, excluirItemPermanente } = useLixeira();
  const [paraExcluirDefinitivo, setParaExcluirDefinitivo] = useState(null);
  const toast = useToast();

  async function aoRestaurar(item) {
    await restaurarItem(item._tabela, item.id);
    toast.sucesso(`"${nomeExibicao(item)}" foi restaurado`);
  }

  async function confirmarExclusaoDefinitiva() {
    await excluirItemPermanente(paraExcluirDefinitivo._tabela, paraExcluirDefinitivo.id);
    toast.sucesso('Registro excluído definitivamente');
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
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <TableBotaoAcao title="Restaurar" onClick={() => aoRestaurar(item)}>
                      <RotateCcw size={16} />
                    </TableBotaoAcao>
                    <TableBotaoAcao title="Excluir definitivamente" onClick={() => setParaExcluirDefinitivo(item)}>
                      <X size={16} />
                    </TableBotaoAcao>
                  </div>
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
    </div>
  );
}
