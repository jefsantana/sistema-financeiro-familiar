import { useMemo, useState } from 'react';
import { UtensilsCrossed, TrendingDown, TrendingUp, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  Card,
  Badge,
  Avatar,
  Input,
  Select,
  Button,
  EmptyState,
  InfoBanner,
  Table,
  TableColunaAcoes,
  TableColunaNumerica,
  TableBotaoAcao,
  ConfirmDialog,
  SkeletonLinha,
} from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  registrarMovimentoAlimentacao,
  editarMovimentoAlimentacao,
  excluirMovimentoAlimentacao,
} from '../../utils/cartaoAlimentacao.js';
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
  const [edicao, setEdicao] = useState(null);
  const [paraExcluir, setParaExcluir] = useState(null);
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

  function iniciarEdicao(mov) {
    setEdicao({
      id: mov.id,
      descricao: mov.descricao || '',
      valor: Number(mov.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  }

  function cancelarEdicao() {
    setEdicao(null);
  }

  function atualizarCampoEdicao(nome, valor) {
    const valorLimpo = nome === 'valor' ? mascaraMoeda(valor) : valor;
    setEdicao((atual) => ({ ...atual, [nome]: valorLimpo }));
  }

  async function salvarEdicao() {
    const valorNumerico = parseValorMonetario(edicao.valor);
    if (valorNumerico <= 0) {
      toast.erro('Informe um valor maior que zero.');
      return;
    }
    const movimentoAntigo = movimentos.find((m) => m.id === edicao.id);
    const cartao = cartaoPorId[movimentoAntigo.cartaoAlimentacaoId];
    try {
      await editarMovimentoAlimentacao({
        movimentoAntigo,
        descricao: edicao.descricao.trim(),
        valor: valorNumerico,
        cartao,
      });
      await Promise.all([recarregarCartoes(), recarregarMovimentos()]);
      toast.sucesso('Alterações salvas com sucesso');
      setEdicao(null);
    } catch {
      toast.erro('Não foi possível salvar as alterações. Tente novamente.');
    }
  }

  async function confirmarExclusao() {
    const movimento = movimentos.find((m) => m.id === paraExcluir);
    const cartao = cartaoPorId[movimento.cartaoAlimentacaoId];
    try {
      await excluirMovimentoAlimentacao({ movimento, cartao, pessoa: pessoaLogada });
      await Promise.all([recarregarCartoes(), recarregarMovimentos()]);
      toast.sucesso('Registro movido para a lixeira');
    } catch {
      toast.erro('Não foi possível excluir o registro. Tente novamente.');
    } finally {
      setParaExcluir(null);
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
              <th />
            </tr>
          </thead>
          <tbody>
            {movimentosOrdenados.map((mov) => {
              const nomeCartao = cartaoPorId[mov.cartaoAlimentacaoId]?.nome || '-';
              const ehRecarga = mov.tipo === 'recarga';
              const emEdicao = edicao?.id === mov.id;
              return (
                <tr key={mov.id}>
                  <td data-rotulo="Data">{formatarData(mov.data)}</td>
                  <td data-rotulo="Descrição">
                    {emEdicao ? (
                      <Input
                        aria-label="Descrição"
                        value={edicao.descricao}
                        onChange={(e) => atualizarCampoEdicao('descricao', e.target.value)}
                        className={formStyles.campoInline}
                      />
                    ) : (
                      mov.descricao
                    )}
                  </td>
                  <td data-rotulo="Cartão">{nomeCartao}</td>
                  <td data-rotulo="Tipo">
                    <Badge cor={ehRecarga ? 'sucesso' : 'perigo'}>
                      {ehRecarga ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {ehRecarga ? 'Recarga' : 'Gasto'}
                    </Badge>
                  </td>
                  <td data-rotulo="Pessoa">
                    {mov.pessoa ? <Avatar nome={mov.pessoa} tamanho="pequeno" /> : '-'}
                  </td>
                  <TableColunaNumerica data-rotulo="Valor">
                    {emEdicao ? (
                      <Input
                        aria-label="Valor"
                        inputMode="decimal"
                        value={edicao.valor}
                        onChange={(e) => atualizarCampoEdicao('valor', e.target.value)}
                        className={formStyles.campoInline}
                      />
                    ) : (
                      <span className={ehRecarga ? 'valor-positivo' : 'valor-negativo'}>
                        {ehRecarga ? '+' : '-'} {formatarMoeda(mov.valor)}
                      </span>
                    )}
                  </TableColunaNumerica>
                  <TableColunaAcoes>
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
                          onClick={() => iniciarEdicao(mov)}
                        >
                          <Pencil size={16} />
                        </TableBotaoAcao>
                        <TableBotaoAcao
                          title="Excluir"
                          rotulo="Excluir"
                          disabled={Boolean(edicao)}
                          onClick={() => setParaExcluir(mov.id)}
                        >
                          <Trash2 size={16} />
                        </TableBotaoAcao>
                      </>
                    )}
                  </TableColunaAcoes>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        aberto={Boolean(paraExcluir)}
        aoFechar={() => setParaExcluir(null)}
        aoConfirmar={confirmarExclusao}
        titulo="Excluir registro?"
        mensagem="O registro vai para a Lixeira e pode ser restaurado a qualquer momento. O saldo do cartão será ajustado."
        textoConfirmar="Excluir"
      />
    </div>
  );
}
