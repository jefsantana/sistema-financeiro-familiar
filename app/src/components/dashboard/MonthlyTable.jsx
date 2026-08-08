import { CalendarRange } from 'lucide-react';
import { EmptyState, Table, TableColunaNumerica } from '../ui/index.js';
import { formatarMoeda } from '../../utils/formatadores.js';

export function MonthlyTable({ resumo }) {
  if (resumo.length === 0) {
    return <EmptyState icone={CalendarRange} titulo="Sem histórico suficiente" descricao="O resumo mensal aparece assim que houver lançamentos em mais de um mês." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <th>Mês</th>
          <th>Entradas</th>
          <th>Saídas</th>
          <th>Saldo</th>
        </tr>
      </thead>
      <tbody>
        {resumo.map((mes) => (
          <tr key={mes.mesAno}>
            <td data-rotulo="Mês">{mes.nome}</td>
            <TableColunaNumerica data-rotulo="Entradas">
              <span className="valor-positivo">{formatarMoeda(mes.entrada)}</span>
            </TableColunaNumerica>
            <TableColunaNumerica data-rotulo="Saídas">
              <span className="valor-negativo">{formatarMoeda(mes.saida)}</span>
            </TableColunaNumerica>
            <TableColunaNumerica data-rotulo="Saldo">
              <span className={mes.saldo >= 0 ? 'valor-positivo' : 'valor-negativo'}>{formatarMoeda(mes.saldo)}</span>
            </TableColunaNumerica>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
