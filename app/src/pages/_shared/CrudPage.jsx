import { useMemo, useState } from 'react';
import { Trash2, Pencil, X, Check } from 'lucide-react';
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

function valoresDoRegistro(registro, campos) {
  const valores = {};
  campos.forEach((campo) => {
    const bruto = registro[campo.nome];
    valores[campo.nome] =
      campo.tipo === 'moeda' && typeof bruto === 'number'
        ? bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : (bruto ?? '');
  });
  return valores;
}

export default function CrudPage({ config }) {
  const { tabela, icone: Icone, tituloForm, tituloLista, campos, colunas, textoVazioLista, dica } = config;
  const { registros, carregando, salvando, salvar, editar, remover } = useCrudMock(tabela);
  const [valoresNovo, setValoresNovo] = useState(estadoInicial(campos));
  const [edicao, setEdicao] = useState(null);
  const [paraExcluir, setParaExcluir] = useState(null);
  const toast = useToast();
  const { perfil, usuario } = useAuth();
  const pessoaLogada = nomeExibicao(perfil, usuario).split(' ')[0];
  const temColunaPessoa = colunas.some((c) => c.chave === 'pessoa') && !campos.some((c) => c.nome === 'pessoa');

  const registrosOrdenados = useMemo(
    () => [...registros].sort((a, b) => new Date(b.data || b.criadoEm) - new Date(a.data || a.criadoEm)),
    [registros]
  );

  function atualizarCampoNovo(nome, valor, tipo) {
    const valorLimpo = tipo === 'moeda' ? mascaraMoeda(valor) : valor;
    setValoresNovo((atual) => ({ ...atual, [nome]: valorLimpo }));
  }

  function atualizarCampoEdicao(nome, valor, tipo) {
    const valorLimpo = tipo === 'moeda' ? mascaraMoeda(valor) : valor;
    setEdicao((atual) => ({ ...atual, valores: { ...atual.valores, [nome]: valorLimpo } }));
  }

  function iniciarEdicao(registro) {
    setEdicao({ id: registro.id, valores: valoresDoRegistro(registro, campos) });
  }

  function cancelarEdicao() {
    setEdicao(null);
  }

  // Valida os campos e monta o objeto pronto pra salvar; mostra o
  // toast de erro e retorna null quando algo está inválido.
  function validarEConstruir(valoresParaValidar) {
    const campoVazio = campos.find(
      (campo) => campo.obrigatorio && campo.tipo !== 'moeda' && !String(valoresParaValidar[campo.nome] ?? '').trim()
    );
    if (campoVazio) {
      toast.erro(`Preencha o campo "${campoVazio.rotulo}".`);
      return null;
    }

    const campoMoedaInvalido = campos.find(
      (campo) => campo.tipo === 'moeda' && campo.obrigatorio && parseValorMonetario(valoresParaValidar[campo.nome]) <= 0
    );
    if (campoMoedaInvalido) {
      toast.erro(`Informe um valor maior que zero em "${campoMoedaInvalido.rotulo}".`);
      return null;
    }

    const dados = {};
    campos.forEach((campo) => {
      dados[campo.nome] = converterValor(campo, valoresParaValidar[campo.nome]);
    });

    if (config.validar) {
      const mensagemErro = config.validar(dados);
      if (mensagemErro) {
        toast.erro(mensagemErro);
        return null;
      }
    }

    return dados;
  }

  async function aoCriar(evento) {
    evento.preventDefault();
    const dados = validarEConstruir(valoresNovo);
    if (!dados) return;

    try {
      if (temColunaPessoa) {
        dados.pessoa = pessoaLogada;
      }
      const tratadoPorAlternativa =
        config.criarAlternativo && (await config.criarAlternativo({ dados, familiaId: perfil?.familia_id, pessoa: pessoaLogada }));
      if (!tratadoPorAlternativa) {
        await salvar(dados);
        toast.sucesso('Lançamento salvo com sucesso');
      }
    } catch {
      return;
    }
    setValoresNovo(estadoInicial(campos));
  }

  async function salvarEdicao() {
    const dados = validarEConstruir(edicao.valores);
    if (!dados) return;

    try {
      await editar(edicao.id, dados);
      toast.sucesso('Alterações salvas com sucesso');
    } catch {
      return;
    }
    setEdicao(null);
  }

  async function confirmarExclusao() {
    try {
      await remover(paraExcluir, pessoaLogada);
      toast.sucesso('Registro movido para a lixeira');
    } catch {
      // erro já sinalizado pelo hook useCrudMock
    }
  }

  function renderCampoInline(campo) {
    const valorAtual = edicao.valores[campo.nome];
    if (campo.tipo === 'select') {
      return (
        <Select
          aria-label={campo.rotulo}
          required={campo.obrigatorio}
          icone={campo.iconePorValor ? campo.iconePorValor(valorAtual) : undefined}
          value={valorAtual}
          onChange={(e) => atualizarCampoEdicao(campo.nome, e.target.value)}
          className={styles.campoInline}
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
        aria-label={campo.rotulo}
        required={campo.obrigatorio}
        type={campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text'}
        inputMode={campo.tipo === 'moeda' ? 'decimal' : undefined}
        min={campo.min}
        max={campo.max}
        placeholder={campo.placeholder || (campo.tipo === 'moeda' ? '0,00' : undefined)}
        value={valorAtual}
        onChange={(e) => atualizarCampoEdicao(campo.nome, e.target.value, campo.tipo)}
        className={styles.campoInline}
      />
    );
  }

  return (
    <div>
      <div className={styles.cabecalhoPagina}>
        <Icone size={20} className={styles.iconePagina} />
        <h1>{tituloForm}</h1>
      </div>

      {dica && <InfoBanner>{dica}</InfoBanner>}

      <form className={styles.formulario} onSubmit={aoCriar} noValidate>
        {campos.map((campo) => {
          if (campo.tipo === 'select') {
            return (
              <Select
                key={campo.nome}
                rotulo={campo.rotulo}
                required={campo.obrigatorio}
                icone={campo.iconePorValor ? campo.iconePorValor(valoresNovo[campo.nome]) : undefined}
                value={valoresNovo[campo.nome]}
                onChange={(e) => atualizarCampoNovo(campo.nome, e.target.value)}
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
              value={valoresNovo[campo.nome]}
              onChange={(e) => atualizarCampoNovo(campo.nome, e.target.value, campo.tipo)}
              className={styles.campoFlex}
            />
          );
        })}

        <div className={styles.acoesFormulario}>
          <Button type="submit" carregando={salvando} className={styles.botaoSalvar}>
            Salvar
          </Button>
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
            {registrosOrdenados.map((registro) => {
              const emEdicao = edicao?.id === registro.id;
              return (
                <tr key={registro.id}>
                  {colunas.map((coluna) => {
                    const campoCorrespondente = campos.find((c) => c.nome === coluna.chave);
                    if (emEdicao && campoCorrespondente) {
                      return (
                        <td key={coluna.chave} data-rotulo={coluna.rotulo}>
                          {renderCampoInline(campoCorrespondente)}
                        </td>
                      );
                    }
                    const conteudo = coluna.render ? coluna.render(registro) : registro[coluna.chave];
                    return coluna.numerica ? (
                      <TableColunaNumerica key={coluna.chave} data-rotulo={coluna.rotulo}>
                        {conteudo}
                      </TableColunaNumerica>
                    ) : (
                      <td key={coluna.chave} data-rotulo={coluna.rotulo}>
                        {conteudo}
                      </td>
                    );
                  })}
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
                          onClick={() => iniciarEdicao(registro)}
                        >
                          <Pencil size={16} />
                        </TableBotaoAcao>
                        <TableBotaoAcao
                          title="Excluir"
                          rotulo="Excluir"
                          disabled={Boolean(edicao)}
                          onClick={() => setParaExcluir(registro.id)}
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
        mensagem="O registro vai para a Lixeira e pode ser restaurado a qualquer momento."
        textoConfirmar="Excluir"
      />
    </div>
  );
}
