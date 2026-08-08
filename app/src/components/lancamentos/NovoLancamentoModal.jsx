import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { Modal } from '../ui/Modal/Modal.jsx';
import { Input, Select, Button } from '../ui/index.js';
import { SeletorPessoa } from './SeletorPessoa.jsx';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { criar } from '../../services/mockData.js';
import { parseValorMonetario, nomeExibicao } from '../../utils/formatadores.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from './NovoLancamentoModal.module.css';

const HOJE = () => new Date().toISOString().slice(0, 10);

function estadoInicial(pessoas) {
  return {
    descricao: '',
    valor: '',
    categoria: '',
    cartao: '',
    data: HOJE(),
    pessoaOrigem: pessoas[0],
    pessoaDestino: pessoas[1] ?? pessoas[0],
  };
}

export function NovoLancamentoModal({ aberto, aoFechar }) {
  const [tipo, setTipo] = useState('gasto');
  const { perfil, usuario, pessoas } = useAuth();
  const [campos, setCampos] = useState(() => estadoInicial(pessoas));
  const [salvando, setSalvando] = useState(false);
  const { registros: categorias } = useCrudMock('Categorias');
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

  const categoriasDoTipo = categorias.filter((c) => c.tipo === (tipo === 'entrada' ? 'entrada' : 'gasto'));

  function atualizarCampo(nome, valor) {
    const valorLimpo = nome === 'valor' ? valor.replace(/-/g, '') : valor;
    setCampos((atual) => ({ ...atual, [nome]: valorLimpo }));
  }

  async function salvarLancamento(evento) {
    evento.preventDefault();

    if (parseValorMonetario(campos.valor) <= 0) {
      toast.erro('Informe um valor maior que zero.');
      return;
    }

    setSalvando(true);
    try {
      if (tipo === 'transferencia') {
        await criar('Transferencias', {
          descricao: campos.descricao,
          valor: parseValorMonetario(campos.valor),
          data: campos.data,
          pessoaOrigem: campos.pessoaOrigem,
          pessoaDestino: campos.pessoaDestino,
        });
      } else {
        const tabela = tipo === 'entrada' ? 'Entradas' : 'Gastos';
        await criar(tabela, {
          descricao: campos.descricao,
          valor: parseValorMonetario(campos.valor),
          data: campos.data,
          categoria: campos.categoria,
          pessoa: nomeExibicao(perfil, usuario).split(' ')[0],
          ...(tipo === 'gasto' ? { cartao: campos.cartao } : {}),
        });
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

      <form className={styles.form} onSubmit={salvarLancamento}>
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
              value={campos.categoria}
              onChange={(e) => atualizarCampo('categoria', e.target.value)}
            >
              <option value="">Selecione</option>
              {categoriasDoTipo.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
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
