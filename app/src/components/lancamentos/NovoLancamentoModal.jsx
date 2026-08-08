import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { Modal } from '../ui/Modal/Modal.jsx';
import { Input, Select, Button } from '../ui/index.js';
import { SeletorPessoa } from './SeletorPessoa.jsx';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { criar } from '../../services/dados.js';
import { parseValorMonetario, nomeExibicao, dataLocalDeHoje } from '../../utils/formatadores.js';
import { CATEGORIAS_GASTO_FIXAS, CATEGORIAS_ENTRADA_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO, ICONES_CATEGORIA_ENTRADA } from '../../utils/icones.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from './NovoLancamentoModal.module.css';

function estadoInicial(pessoas) {
  return {
    descricao: '',
    valor: '',
    categoria: '',
    cartao: '',
    data: dataLocalDeHoje(),
    pessoaOrigem: pessoas[0],
    pessoaDestino: pessoas[1] ?? pessoas[0],
  };
}

export function NovoLancamentoModal({ aberto, aoFechar }) {
  const [tipo, setTipo] = useState('gasto');
  const { perfil, usuario, pessoas } = useAuth();
  const [campos, setCampos] = useState(() => estadoInicial(pessoas));
  const [salvando, setSalvando] = useState(false);
  const { registros: cartoes } = useCrudMock('Cartoes');
  const toast = useToast();
  const temSegundaPessoa = pessoas.length > 1;

  useEffect(() => {
    if (aberto) {
      setTipo('gasto');
      setCampos(estadoInicial(pessoas));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function atualizarCampo(nome, valor) {
    const valorLimpo = nome === 'valor' ? valor.replace(/-/g, '') : valor;
    setCampos((atual) => ({ ...atual, [nome]: valorLimpo }));
  }

  async function salvarLancamento(evento) {
    evento.preventDefault();

    if (!campos.descricao.trim()) {
      toast.erro('Preencha a descrição.');
      return;
    }
    if (parseValorMonetario(campos.valor) <= 0) {
      toast.erro('Informe um valor maior que zero.');
      return;
    }
    if (!campos.data) {
      toast.erro('Informe a data.');
      return;
    }
    if (tipo !== 'transferencia' && !campos.categoria.trim()) {
      toast.erro('Escolha uma categoria.');
      return;
    }

    const familiaId = perfil?.familia_id;
    setSalvando(true);
    try {
      if (tipo === 'transferencia') {
        await criar(
          'Transferencias',
          {
            descricao: campos.descricao,
            valor: parseValorMonetario(campos.valor),
            data: campos.data,
            pessoaOrigem: campos.pessoaOrigem,
            pessoaDestino: campos.pessoaDestino,
          },
          familiaId
        );
      } else {
        const tabela = tipo === 'entrada' ? 'Entradas' : 'Gastos';
        await criar(
          tabela,
          {
            descricao: campos.descricao,
            valor: parseValorMonetario(campos.valor),
            data: campos.data,
            categoria: campos.categoria,
            pessoa: nomeExibicao(perfil, usuario).split(' ')[0],
            ...(tipo === 'gasto' ? { cartao: campos.cartao } : {}),
          },
          familiaId
        );
      }
      toast.sucesso('Lançamento salvo com sucesso');
      aoFechar();
    } catch {
      toast.erro('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo lançamento">
      <div className={styles.tipos}>
        <button
          type="button"
          className={`${styles.tipoBotao} ${styles.tipoEntrada} ${tipo === 'entrada' ? styles.tipoAtivo : ''}`}
          onClick={() => setTipo('entrada')}
        >
          <TrendingUp />
          Entrada
        </button>
        <button
          type="button"
          className={`${styles.tipoBotao} ${styles.tipoGasto} ${tipo === 'gasto' ? styles.tipoAtivo : ''}`}
          onClick={() => setTipo('gasto')}
        >
          <TrendingDown />
          Gasto
        </button>
        {temSegundaPessoa && (
          <button
            type="button"
            className={`${styles.tipoBotao} ${styles.tipoTransferencia} ${tipo === 'transferencia' ? styles.tipoAtivo : ''}`}
            onClick={() => setTipo('transferencia')}
          >
            <ArrowLeftRight />
            Transferência
          </button>
        )}
      </div>

      <form className={styles.form} onSubmit={salvarLancamento} noValidate>
        <Input
          rotulo="Descrição"
          required
          placeholder={tipo === 'entrada' ? 'Ex: Salário' : tipo === 'gasto' ? 'Ex: Supermercado' : 'Ex: Reserva para viagem'}
          value={campos.descricao}
          onChange={(e) => atualizarCampo('descricao', e.target.value)}
        />

        <div className={styles.linha}>
          <Input
            rotulo="Valor (R$)"
            required
            inputMode="decimal"
            placeholder="0,00"
            value={campos.valor}
            onChange={(e) => atualizarCampo('valor', e.target.value)}
          />
          <Input
            rotulo="Data"
            type="date"
            required
            value={campos.data}
            onChange={(e) => atualizarCampo('data', e.target.value)}
          />
        </div>

        {tipo !== 'transferencia' && (
          <div className={styles.linha}>
            <Select
              rotulo="Categoria"
              required
              icone={
                tipo === 'entrada' ? ICONES_CATEGORIA_ENTRADA[campos.categoria] : ICONES_CATEGORIA_GASTO[campos.categoria]
              }
              value={campos.categoria}
              onChange={(e) => atualizarCampo('categoria', e.target.value)}
            >
              <option value="">Selecione</option>
              {(tipo === 'entrada' ? CATEGORIAS_ENTRADA_FIXAS : CATEGORIAS_GASTO_FIXAS).map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </Select>
            {tipo === 'gasto' && (
              <Select
                rotulo="Cartão (opcional)"
                value={campos.cartao}
                onChange={(e) => atualizarCampo('cartao', e.target.value)}
              >
                <option value="">Nenhum</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        {tipo === 'transferencia' && (
          <div className={`${styles.linha} ${styles.linhaPessoas}`}>
            <SeletorPessoa
              rotulo="De"
              valor={campos.pessoaOrigem}
              aoSelecionar={(p) => atualizarCampo('pessoaOrigem', p)}
            />
            <SeletorPessoa
              rotulo="Para"
              valor={campos.pessoaDestino}
              aoSelecionar={(p) => atualizarCampo('pessoaDestino', p)}
            />
          </div>
        )}

        <Button type="submit" larguraTotal className={styles.acoes} carregando={salvando}>
          Salvar
        </Button>
      </form>
    </Modal>
  );
}
