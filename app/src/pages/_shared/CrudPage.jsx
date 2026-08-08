import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Input,
  Select,
  Button,
  EmptyState,
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
import { parseValorMonetario, nomeExibicao } from '../../utils/formatadores.js';
import styles from './CrudPage.module.css';

function estadoInicial(campos) {
  const estado = {};
  campos.forEach((campo) => {
    estado[campo.nome] = '';
  });
  return estado;
}

function converterValor(campo, bruto) {
  if (campo.tipo === 'moeda') return parseValorMonetario(bruto);
  if (campo.tipo === 'numero') return Number(bruto);
  return bruto;
}

export default function CrudPage({ config }) {
  const { tabela, icone: Icone, tituloForm, tituloLista, campos, colunas, textoVazioLista } = config;
  const { registros, carregando, salvando, salvar, remover } = useCrudMock(tabela);
  const [valores, setValores] = useState(estadoInicial(campos));
  const [paraExcluir, setParaExcluir] = useState(null);
  const toast = useToast();
  const { perfil, usuario } = useAuth();

  const registrosOrdenados = useMemo(
    () => [...registros].sort((a, b) => new Date(b.data || b.criadoEm) - new Date(a.data || a.criadoEm)),
    [registros]
  );

  function atualizarCampo(nome, valor, tipo) {
    const valorLimpo = tipo === 'moeda' ? valor.replace(/-/g, '') : valor;
    setValores((atual) => ({ ...atual, [nome]: valorLimpo }));
  }

  function formatarCampoMoedaAoSair(nome) {
    setValores((atual) => {
      if (!atual[nome]) return atual;
      const numero = parseValorMonetario(atual[nome]);
      return { ...atual, [nome]: numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
    });
  }

  async function aoSalvar(evento) {
    evento.preventDefault();

    const campoMoedaInvalido = campos.find(
      (campo) => campo.tipo === 'moeda' && campo.obrigatorio && parseValorMonetario(valores[campo.nome]) <= 0
    );
    if (campoMoedaInvalido) {
      toast.erro(`Informe um valor maior que zero em "${campoMoedaInvalido.rotulo}".`);
      return;
    }

    const dados = {};
    campos.forEach((campo) => {
      dados[campo.nome] = converterValor(campo, valores[campo.nome]);
    });

    if (colunas.some((c) => c.chave === 'pessoa') && !campos.some((c) => c.nome === 'pessoa')) {
      dados.pessoa = nomeExibicao(perfil, usuario).split(' ')[0];
    }

    await salvar(dados);
    setValores(estadoInicial(campos));
    toast.sucesso('✓ Lançamento salvo com sucesso');
  }

  async function confirmarExclusao() {
    await remover(paraExcluir);
    toast.sucesso('Registro movido para a lixeira');
  }

  return (
    <div>
      <div className={styles.cabecalhoPagina}>
        <h1>{tituloForm}</h1>
      </div>

      <form className={styles.formulario} onSubmit={aoSalvar}>
        {campos.map((campo) => {
          if (campo.tipo === 'select') {
            return (
              <Select
                key={campo.nome}
                rotulo={campo.rotulo}
                required={campo.obrigatorio}
                value={valores[campo.nome]}
                onChange={(e) => atualizarCampo(campo.nome, e.target.value)}
                className={styles.campoFlex}
              >
                <option value="">{campo.obrigatorio ? 'Selecione' : 'Nenhum'}</option>
                {campo.opcoes.map((opcao) => (
                  <option key={opcao.valor ?? opcao} value={opcao.valor ?? opcao}>
                    {opcao.rotulo ?? opcao}
                  </option>
                ))}
              </Select>
            );
          }

          return (
            <Input
              key={campo.nome}
              rotulo={campo.rotulo}
              required={campo.obrigatorio}
              type={campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text'}
              inputMode={campo.tipo === 'moeda' ? 'decimal' : undefined}
              min={campo.min}
              max={campo.max}
              placeholder={campo.placeholder || (campo.tipo === 'moeda' ? '0,00' : undefined)}
              value={valores[campo.nome]}
              onChange={(e) => atualizarCampo(campo.nome, e.target.value, campo.tipo)}
              onBlur={campo.tipo === 'moeda' ? () => formatarCampoMoedaAoSair(campo.nome) : undefined}
              className={styles.campoFlex}
            />
          );
        })}

        <Button type="submit" carregando={salvando} className={styles.botaoSalvar}>
          Salvar
        </Button>
      </form>

      <h3 className={styles.tituloLista}>{tituloLista}</h3>

      {carregando ? (
        <div>
          <SkeletonLinha />
          <SkeletonLinha />
          <SkeletonLinha />
        </div>
      ) : registrosOrdenados.length === 0 ? (
        <EmptyState icone={Icone} titulo="Nada por aqui ainda" descricao={textoVazioLista} />
      ) : (
        <Table>
          <thead>
            <tr>
              {colunas.map((coluna) => (
                <th key={coluna.chave}>{coluna.rotulo}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {registrosOrdenados.map((registro) => (
              <tr key={registro.id}>
                {colunas.map((coluna) =>
                  coluna.numerica ? (
                    <TableColunaNumerica key={coluna.chave} data-rotulo={coluna.rotulo}>
                      {coluna.render ? coluna.render(registro) : registro[coluna.chave]}
                    </TableColunaNumerica>
                  ) : (
                    <td key={coluna.chave} data-rotulo={coluna.rotulo}>
                      {coluna.render ? coluna.render(registro) : registro[coluna.chave]}
                    </td>
                  )
                )}
                <TableColunaAcoes>
                  <TableBotaoAcao title="Excluir" onClick={() => setParaExcluir(registro.id)}>
                    <Trash2 size={16} />
                  </TableBotaoAcao>
                </TableColunaAcoes>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        aberto={Boolean(paraExcluir)}
        aoFechar={() => setParaExcluir(null)}
        aoConfirmar={confirmarExclusao}
        titulo="Excluir registro?"
        mensagem="O registro vai para a Lixeira e pode ser restaurado a qualquer momento."
        textoConfirmar="Excluir"
      />
    </div>
  );
}
