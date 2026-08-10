import { useMemo, useState } from 'react';
import { Trash2, Pencil, X } from 'lucide-react';
import {
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
import { parseValorMonetario, mascaraMoeda, nomeExibicao } from '../../utils/formatadores.js';
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
  const { tabela, icone: Icone, tituloForm, tituloLista, campos, colunas, textoVazioLista, dica } = config;
  const { registros, carregando, salvando, salvar, editar, remover } = useCrudMock(tabela);
  const [valores, setValores] = useState(estadoInicial(campos));
  const [editando, setEditando] = useState(null);
  const [paraExcluir, setParaExcluir] = useState(null);
  const toast = useToast();
  const { perfil, usuario } = useAuth();
  const pessoaLogada = nomeExibicao(perfil, usuario).split(' ')[0];
  const temColunaPessoa = colunas.some((c) => c.chave === 'pessoa') && !campos.some((c) => c.nome === 'pessoa');

  const registrosOrdenados = useMemo(
    () => [...registros].sort((a, b) => new Date(b.data || b.criadoEm) - new Date(a.data || a.criadoEm)),
    [registros]
  );

  function atualizarCampo(nome, valor, tipo) {
    const valorLimpo = tipo === 'moeda' ? mascaraMoeda(valor) : valor;
    setValores((atual) => ({ ...atual, [nome]: valorLimpo }));
  }

  function iniciarEdicao(registro) {
    const valoresDoRegistro = {};
    campos.forEach((campo) => {
      const bruto = registro[campo.nome];
      valoresDoRegistro[campo.nome] =
        campo.tipo === 'moeda' && typeof bruto === 'number'
          ? bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : (bruto ?? '');
    });
    setEditando({ id: registro.id, rotulo: registro.descricao || registro.nome || '' });
    setValores(valoresDoRegistro);
  }

  function cancelarEdicao() {
    setEditando(null);
    setValores(estadoInicial(campos));
  }

  async function aoSalvar(evento) {
    evento.preventDefault();

    const campoVazio = campos.find(
      (campo) => campo.obrigatorio && campo.tipo !== 'moeda' && !String(valores[campo.nome] ?? '').trim()
    );
    if (campoVazio) {
      toast.erro(`Preencha o campo "${campoVazio.rotulo}".`);
      return;
    }

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

    if (config.validar) {
      const mensagemErro = config.validar(dados);
      if (mensagemErro) {
        toast.erro(mensagemErro);
        return;
      }
    }

    try {
      if (editando) {
        await editar(editando.id, dados);
        toast.sucesso('Alterações salvas com sucesso');
      } else {
        if (temColunaPessoa) {
          dados.pessoa = pessoaLogada;
        }
        await salvar(dados);
        toast.sucesso('Lançamento salvo com sucesso');
      }
    } catch {
      return;
    }
    setEditando(null);
    setValores(estadoInicial(campos));
  }

  async function confirmarExclusao() {
    try {
      await remover(paraExcluir, pessoaLogada);
      toast.sucesso('Registro movido para a lixeira');
    } catch {
      // erro já sinalizado pelo hook useCrudMock
    }
  }

  return (
    <div>
      <div className={styles.cabecalhoPagina}>
        <Icone size={20} className={styles.iconePagina} />
        <h1>{editando ? `Editando: ${editando.rotulo || tituloForm}` : tituloForm}</h1>
      </div>

      {dica && <InfoBanner>{dica}</InfoBanner>}

      <form className={styles.formulario} onSubmit={aoSalvar} noValidate>
        {campos.map((campo) => {
          if (campo.tipo === 'select') {
            return (
              <Select
                key={campo.nome}
                rotulo={campo.rotulo}
                required={campo.obrigatorio}
                icone={campo.iconePorValor ? campo.iconePorValor(valores[campo.nome]) : undefined}
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
              className={styles.campoFlex}
            />
          );
        })}

        <div className={styles.acoesFormulario}>
          <Button type="submit" carregando={salvando} className={styles.botaoSalvar}>
            {editando ? 'Salvar alterações' : 'Salvar'}
          </Button>
          {editando && (
            <Button type="button" variante="secundario" onClick={cancelarEdicao}>
              <X size={16} /> Cancelar
            </Button>
          )}
        </div>
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
                  <TableBotaoAcao title="Editar" rotulo="Editar" onClick={() => iniciarEdicao(registro)}>
                    <Pencil size={16} />
                  </TableBotaoAcao>
                  <TableBotaoAcao title="Excluir" rotulo="Excluir" onClick={() => setParaExcluir(registro.id)}>
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
