export function somar(lista) {
  return lista.reduce((soma, item) => soma + Number(item.valor), 0);
}

export function mesAnoDe(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function obterMesAno(dataStr) {
  const data = new Date(dataStr);
  if (isNaN(data.getTime())) return '';
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function normalizarMesAno(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}$/.test(valor)) return valor;
  const data = new Date(valor);
  if (isNaN(data.getTime())) return String(valor);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calcula quantos dias faltam até o dia de vencimento no mês atual.
 * Ajusta o dia para o último dia do mês quando ele não existe
 * (ex: dia 31 em fevereiro vira o último dia de fevereiro).
 */
export function diasAteVencimento(dia) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
  const diaAjustado = Math.min(Number(dia), ultimoDiaDoMes);
  const dataVencimento = new Date(ano, mes, diaAjustado);
  return Math.round((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
}

/**
 * Percentual de variação entre o valor atual e o anterior.
 * `inverter` troca o sentido de "bom"/"ruim" — usado para gastos,
 * onde uma queda é positiva.
 */
export function calcularTendencia(atual, anterior, inverter = false) {
  if (anterior === 0) return null;
  const percentual = Math.round(((atual - anterior) / anterior) * 100);
  const subiu = percentual >= 0;
  const bom = inverter ? !subiu : subiu;
  return { percentual: Math.abs(percentual), subiu, bom };
}

export function calcularAlertasContasFixas(contasFixas, pagamentos) {
  const mesAnoAtual = mesAnoDe(new Date());
  const idsPagos = pagamentos
    .filter(p => normalizarMesAno(p.mesAno) === mesAnoAtual)
    .map(p => String(p.contaFixaId));

  return contasFixas
    .filter(c => !idsPagos.includes(String(c.id)))
    .map(c => ({
      tipo: 'contaFixa',
      id: c.id,
      descricao: c.descricao,
      valor: Number(c.valor),
      categoria: c.categoria,
      cartao: '',
      mesAno: mesAnoAtual,
      diasRestantes: diasAteVencimento(c.diaVencimento)
    }));
}

/**
 * Considera "pendente este mês" todo parcelamento que ainda
 * está em andamento (parcelaAtual <= numeroParcelas) e que
 * ainda não tem pagamento registrado no mês atual.
 */
export function calcularAlertasParcelamentos(parcelamentos, pagamentosParcelamentos) {
  const mesAnoAtual = mesAnoDe(new Date());
  const idsPagos = pagamentosParcelamentos
    .filter(p => normalizarMesAno(p.mesAno) === mesAnoAtual)
    .map(p => String(p.parcelamentoId));

  return parcelamentos
    .filter(p => Number(p.parcelaAtual) <= Number(p.numeroParcelas))
    .filter(p => !idsPagos.includes(String(p.id)))
    .map(p => {
      const valorParcela = Number(p.valorTotal) / Number(p.numeroParcelas);
      return {
        tipo: 'parcelamento',
        id: p.id,
        descricao: `${p.descricao} (parcela ${p.parcelaAtual}/${p.numeroParcelas})`,
        valor: valorParcela,
        categoria: p.categoria || 'Cartão de Crédito',
        cartao: p.cartao || '',
        mesAno: mesAnoAtual,
        parcelaAtual: Number(p.parcelaAtual),
        diasRestantes: diasAteVencimento(p.diaVencimento || 1)
      };
    });
}

/**
 * Determina em qual fatura (mês) uma compra à vista no cartão cai,
 * com base no dia de fechamento do cartão: comprou até o fechamento
 * -> entra na fatura que fecha neste mês; comprou depois -> só entra
 * na fatura do mês seguinte (regra padrão de cartão de crédito).
 */
export function mesFaturaDeCompra(dataCompraIso, diaFechamento) {
  const [ano, mes, dia] = dataCompraIso.split('-').map(Number);
  if (!diaFechamento || dia <= diaFechamento) {
    return `${ano}-${String(mes).padStart(2, '0')}`;
  }
  const proximoMes = new Date(ano, mes, 1);
  return `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Data em que a fatura de um determinado mês vence: sempre no mês
 * seguinte ao mês em que a fatura fechou, no dia de vencimento
 * cadastrado no cartão (com um padrão de dia 10 se não informado).
 */
export function vencimentoDaFatura(mesFatura, diaVencimento) {
  const [ano, mes] = mesFatura.split('-').map(Number);
  const dia = Math.min(diaVencimento || 10, 28);
  return new Date(ano, mes, dia);
}

export function diasAteVencimentoEm(data) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

/**
 * Agrupa compras de cartão ainda não pagas em faturas (por cartão +
 * mês da fatura), pra aparecer nos Próximos Vencimentos do Dashboard.
 */
export function calcularAlertasFaturas(comprasCartao, cartoes) {
  const grupos = {};
  comprasCartao
    .filter((c) => !c.paga)
    .forEach((c) => {
      const chave = `${c.cartao}__${c.mesFatura}`;
      if (!grupos[chave]) grupos[chave] = { cartao: c.cartao, mesFatura: c.mesFatura, valor: 0, itens: [] };
      grupos[chave].valor += Number(c.valor);
      grupos[chave].itens.push(c);
    });

  return Object.entries(grupos).map(([chave, grupo]) => {
    const cartaoInfo = cartoes.find((c) => c.nome === grupo.cartao);
    const vencimento = vencimentoDaFatura(grupo.mesFatura, cartaoInfo?.diaVencimento);
    return {
      tipo: 'fatura',
      id: chave,
      descricao: `Fatura ${grupo.cartao}`,
      valor: grupo.valor,
      categoria: 'Cartão de Crédito',
      cartao: grupo.cartao,
      mesFatura: grupo.mesFatura,
      itens: grupo.itens,
      diasRestantes: diasAteVencimentoEm(vencimento),
    };
  });
}

/**
 * Agrupa as compras de um cartão (à vista ou parceladas) em faturas
 * por mês, pra montar o resumo da tela "Fatura do Cartão". Detecta
 * se uma compra veio de um parcelamento pelo sufixo "(1/N)" que a
 * gente mesmo adiciona na descrição ao gerar a 1ª parcela.
 */
export function agruparComprasPorFatura(comprasCartao) {
  const grupos = {};
  comprasCartao.forEach((c) => {
    const chave = c.mesFatura;
    if (!grupos[chave]) {
      grupos[chave] = { mesFatura: c.mesFatura, valorTotal: 0, totalAVista: 0, totalParcelado: 0, paga: true, itens: [] };
    }
    const parcelado = /\(\d+\/\d+\)$/.test(c.descricao || '');
    grupos[chave].valorTotal += Number(c.valor);
    if (parcelado) grupos[chave].totalParcelado += Number(c.valor);
    else grupos[chave].totalAVista += Number(c.valor);
    if (!c.paga) grupos[chave].paga = false;
    grupos[chave].itens.push({ ...c, parcelado });
  });

  return Object.values(grupos).sort((a, b) => b.mesFatura.localeCompare(a.mesFatura));
}

export function agruparPorCategoria(lista, limite = 5) {
  const mapa = {};
  lista.forEach(item => {
    const cat = item.categoria || 'Sem categoria';
    mapa[cat] = (mapa[cat] || 0) + Number(item.valor);
  });

  const agrupado = Object.keys(mapa).map(label => ({ label, valor: mapa[label] }));
  agrupado.sort((a, b) => b.valor - a.valor);

  if (agrupado.length <= limite) return agrupado;

  const principais = agrupado.slice(0, limite - 1);
  const restante = agrupado.slice(limite - 1).reduce((soma, d) => soma + d.valor, 0);
  return [...principais, { label: 'Outros', valor: restante }];
}

export function agruparPorPessoa(lista) {
  const mapa = {};
  let total = 0;

  lista.forEach(item => {
    const pessoa = item.pessoa || 'Não informado';
    mapa[pessoa] = (mapa[pessoa] || 0) + Number(item.valor);
    total += Number(item.valor);
  });

  return Object.keys(mapa)
    .map(pessoa => ({
      pessoa,
      valor: mapa[pessoa],
      percentual: total > 0 ? Math.round((mapa[pessoa] / total) * 100) : 0
    }))
    .sort((a, b) => b.valor - a.valor);
}

export function nomeDoMes(mesAno, formato) {
  const [ano, mes] = mesAno.split('-');
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  if (formato === 'short') {
    const texto = data.toLocaleDateString('pt-BR', { month: 'short' });
    const semPonto = texto.replace('.', '');
    return semPonto.charAt(0).toUpperCase() + semPonto.slice(1);
  }
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function calcularResumoMensal(entradas, gastos, quantidadeMeses = 6) {
  const mapa = {};

  function registrar(lista, chave) {
    lista.forEach(item => {
      const mesAno = obterMesAno(item.data);
      if (!mesAno) return;
      if (!mapa[mesAno]) mapa[mesAno] = { entrada: 0, saida: 0 };
      mapa[mesAno][chave] += Number(item.valor);
    });
  }

  registrar(entradas, 'entrada');
  registrar(gastos, 'saida');

  return Object.keys(mapa)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, quantidadeMeses)
    .map(mesAno => ({
      mesAno,
      nome: nomeDoMes(mesAno, 'long'),
      nomeCurto: nomeDoMes(mesAno, 'short'),
      entrada: mapa[mesAno].entrada,
      saida: mapa[mesAno].saida,
      saldo: mapa[mesAno].entrada - mapa[mesAno].saida
    }));
}

/**
 * Gera frases curtas com leituras automáticas dos dados do mês —
 * usadas no widget de Insights do dashboard.
 */
export function gerarInsights({ categoriasMes, categoriasMesAnterior, entradasMes, saidasMes, vencimentos, pessoasGasto }) {
  const insights = [];

  const mapaAnterior = Object.fromEntries(categoriasMesAnterior.map((c) => [c.label, c.valor]));
  let maiorAumento = null;
  categoriasMes.forEach((c) => {
    const anterior = mapaAnterior[c.label] || 0;
    if (anterior === 0) return;
    const variacao = ((c.valor - anterior) / anterior) * 100;
    if (variacao > 15 && (!maiorAumento || variacao > maiorAumento.variacao)) {
      maiorAumento = { categoria: c.label, variacao: Math.round(variacao) };
    }
  });
  if (maiorAumento) {
    insights.push({
      tom: 'alerta',
      texto: `Seus gastos com ${maiorAumento.categoria} subiram ${maiorAumento.variacao}% em relação ao mês passado.`,
    });
  }

  if (entradasMes > 0) {
    const taxaEconomia = Math.round(((entradasMes - saidasMes) / entradasMes) * 100);
    if (taxaEconomia >= 20) {
      insights.push({ tom: 'sucesso', texto: `Você está economizando ${taxaEconomia}% da sua renda este mês. Continue assim!` });
    } else if (taxaEconomia < 0) {
      insights.push({ tom: 'perigo', texto: 'Seus gastos já ultrapassaram as entradas deste mês.' });
    }
  }

  const proximaConta = vencimentos.find((v) => v.diasRestantes >= 0 && v.diasRestantes <= 3);
  if (proximaConta) {
    insights.push({
      tom: 'info',
      texto: `${proximaConta.descricao} vence em ${proximaConta.diasRestantes === 0 ? 'hoje' : `${proximaConta.diasRestantes} dia(s)`}.`,
    });
  }

  if (pessoasGasto.length === 2) {
    const [maior] = pessoasGasto;
    if (maior.percentual >= 65) {
      insights.push({
        tom: 'neutro',
        texto: `${maior.pessoa} concentrou ${maior.percentual}% dos gastos do casal este mês.`,
      });
    }
  }

  return insights.slice(0, 4);
}

export function montarUltimosLancamentos(entradas, gastos, limite = 6) {
  return [
    ...entradas.map(e => ({ ...e, tipo: 'entrada' })),
    ...gastos.map(g => ({ ...g, tipo: 'gasto' }))
  ]
    .filter(item => !isNaN(new Date(item.data).getTime()))
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, limite);
}
