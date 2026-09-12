import { useMemo, useState } from 'react';
import { UtensilsCrossed, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Card,
  Badge,
  Input,
  Select,
  Button,
  EmptyState,
  InfoBanner,
  Table,
  TableColunaNumerica,
  SkeletonLinha,
} from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { registrarMovimentoAlimentacao } from '../../utils/cartaoAlimentacao.js';
import { parseValorMonetario, mascaraMoeda, nomeExibicao, formatarMoeda, formatarData } from '../../utils/formatadores.js';
import formStyles from '../_shared/CrudPage.module.css';
import styles from './CartaoAlimentacao.module.css';

const ESTADO_INICIAL = { tipo: 'gasto', cartao: '', descricao: '', valor: '' };

export default function CartaoAlimentacao() {
  const { registros: cartoes, carregando: carregandoCartoes, recarregar: recarregarCartoes } = useCrudMock('CartoesAlimentacao');
  const {
    registros: movimentos,
    carregando: carregandoMovimentos,
    recarregar: recarregarMovimentos,
  } = useCrudMock('MovimentosCartaoAlimentacao');
  const [valores, setValores] = useState(ESTADO_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const { perfil, usuario } = useAuth();
  const pessoaLogada = nomeExibicao(perfil, usuario).split(' ')[0];

  const carregando = carregandoCartoes || carregandoMovimentos;

  const cartaoPorId = useMemo(() => {
    const mapa = {};
    cartoes.forEach((c) => (mapa[c.id] = c));
    return mapa;
  }, [cartoes]);

  const movimentosOrdenados = useMemo(
    () => [...movimentos].sort((a, b) => new Date(b.data || b.criadoEm) - new Date(a.data || a.criadoEm)),
    [movimentos]
  );

  function atualizarCampo(nome, valor) {
    const valorLimpo = nome === 'valor' ? mascaraMoeda(valor) : valor;
    setValores((atual) => ({ ...atual, [nome]: valorLimpo }));
  }

  async function aoSalvar(evento) {
    evento.preventDefault();

    if (!valores.cartao.trim()) {
      toast.erro('Informe o nome do cartão (ex: Ticket).');
      return;
    }
    const valorNumerico = parseValorMonetario(valores.valor);
    if (valorNumerico <= 0) {
      toast.erro('Informe um valor maior que zero.');
      return;
    }

    setSalvando(true);
    try {
      await registrarMovimentoAlimentacao({
        nomeCartao: valores.cartao,
        tipo: valores.tipo,
        descricao: valores.descricao.trim(),
        valor: valorNumerico,
        pessoa: pessoaLogada,
        familiaId: perfil?.familia_id,
        cartoesExistentes: cartoes,
      });
      await Promise.all([recarregarCartoes(), recarregarMovimentos()]);
      toast.sucesso(valores.tipo === 'recarga' ? 'Recarga registrada com sucesso' : 'Gasto registrado com sucesso');
      setValores({ ...ESTADO_INICIAL, cartao: valores.cartao });
    } catch {
      toast.erro('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className={formStyles.cabecalhoPagina}>
        <UtensilsCrossed size={20} className={formStyles.iconePagina} />
        <h1>Cartão Alimentação</h1>
      </div>

      <InfoBanner>
        Gastos com cartão alimentação/refeição (Ticket, VR, Alelo, Sodexo...) descontam do saldo desse cartão em vez de
        entrar como um gasto comum. Recarregue o cartão aqui quando ele receber crédito novo. Isso é o mesmo cartão que o
        bot do WhatsApp usa — os dois lados ficam sempre sincronizados.
      </InfoBanner>

      <form className={formStyles.formulario} onSubmit={aoSalvar} noValidate>
        <Select
          rotulo="Tipo"
          value={valores.tipo}
          onChange={(e) => atualizarCampo('tipo', e.target.value)}
          className={formStyles.campoFlex}
        >
          <option value="gasto">Gasto</option>
          <option value="recarga">Recarga</option>
        </Select>

        <Input
          rotulo="Cartão"
          required
          list="cartoes-alimentacao-existentes"
          placeholder="Ex: Ticket"
          value={valores.cartao}
          onChange={(e) => atualizarCampo('cartao', e.target.value)}
          className={formStyles.campoFlex}
        />
        <datalist id="cartoes-alimentacao-existentes">
          {cartoes.map((c) => (
            <option key={c.id} value={c.nome} />
          ))}
        </datalist>

        <Input
          rotulo="Descrição (opcional)"
          placeholder={valores.tipo === 'recarga' ? 'Recarga do cartão alimentação' : 'Ex: Almoço'}
          value={valores.descricao}
          onChange={(e) => atualizarCampo('descricao', e.target.value)}
          className={formStyles.campoFlex}
        />

        <Input
          rotulo="Valor (R$)"
          required
          inputMode="decimal"
          placeholder="0,00"
          value={valores.valor}
          onChange={(e) => atualizarCampo('valor', e.target.value)}
          className={formStyles.campoFlex}
        />

        <div className={formStyles.acoesFormulario}>
          <Button type="submit" carregando={salvando} className={formStyles.botaoSalvar}>
            Salvar
          </Button>
        </div>
      </form>

      {carregando ? (
        <SkeletonLinha />
      ) : cartoes.length > 0 ? (
        <div className={styles.listaCartoes}>
          {cartoes.map((cartao) => {
            const saldoNegativo = Number(cartao.saldoAtual) < 0;
            return (
              <Card key={cartao.id} className={styles.cardSaldo}>
                <span className={styles.nomeCartao}>{cartao.nome}</span>
                <span className={`${styles.saldo} ${saldoNegativo ? styles.saldoNegativo : ''}`}>
                  {formatarMoeda(cartao.saldoAtual)}
                </span>
                {saldoNegativo && <Badge cor="perigo">Saldo negativo</Badge>}
              </Card>
            );
          })}
        </div>
      ) : null}

      <h3 className={formStyles.tituloLista}>Movimentações</h3>

      {carregando ? (
        <div>
          <SkeletonLinha />
          <SkeletonLinha />
        </div>
      ) : movimentosOrdenados.length === 0 ? (
        <EmptyState
          icone={UtensilsCrossed}
          titulo="Nada por aqui ainda"
          descricao="Registre o primeiro gasto ou recarga usando o formulário acima."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Cartão</th>
              <th>Tipo</th>
              <th>Pessoa</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {movimentosOrdenados.map((mov) => {
              const nomeCartao = cartaoPorId[mov.cartaoAlimentacaoId]?.nome || '-';
              const ehRecarga = mov.tipo === 'recarga';
              return (
                <tr key={mov.id}>
                  <td data-rotulo="Data">{formatarData(mov.data)}</td>
                  <td data-rotulo="Descrição">{mov.descricao}</td>
                  <td data-rotulo="Cartão">{nomeCartao}</td>
                  <td data-rotulo="Tipo">
                    <Badge cor={ehRecarga ? 'sucesso' : 'perigo'}>
                      {ehRecarga ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {ehRecarga ? 'Recarga' : 'Gasto'}
                    </Badge>
                  </td>
                  <td data-rotulo="Pessoa">{mov.pessoa || '-'}</td>
                  <TableColunaNumerica data-rotulo="Valor">
                    <span className={ehRecarga ? 'valor-positivo' : 'valor-negativo'}>
                      {ehRecarga ? '+' : '-'} {formatarMoeda(mov.valor)}
                    </span>
                  </TableColunaNumerica>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
