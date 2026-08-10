export function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Data de "hoje" no formato AAAA-MM-DD, usando o dia local da pessoa
 * (não UTC). Usar toISOString() aqui seria um bug: no fuso do Brasil
 * (UTC-3), todo dia entre ~21h e meia-noite o UTC já virou o dia
 * seguinte, então "hoje" apareceria errado (um dia à frente) nos
 * formulários de lançamento nesse horário.
 */
export function dataLocalDeHoje() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Formata um número no padrão de dinheiro brasileiro:
 * milhar com ponto, decimal com vírgula, com "R$" na frente.
 * Ex: 1250.9 -> "R$ 1.250,90"
 */
export function formatarMoeda(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Converte um texto digitado pelo usuário (aceita vírgula OU
 * ponto como decimal, com ou sem separador de milhar) em um
 * número JavaScript confiável.
 * Ex: "1.250,90" -> 1250.9 | "150,5" -> 150.5 | "150.5" -> 150.5
 */
export function parseValorMonetario(texto) {
  if (typeof texto !== 'string') return Number(texto) || 0;

  let limpo = texto.trim().replace(/[^\d,.-]/g, '');

  if (limpo.includes(',') && limpo.includes('.')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    limpo = limpo.replace(',', '.');
  }

  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

/**
 * Máscara de moeda para campos de digitação: aplica a cada tecla,
 * tratando os últimos 2 dígitos como centavos (padrão de apps de
 * banco). Ex: digitar "2" -> "0,02", "200" -> "2,00", "200000" ->
 * "2.000,00". Ignora tudo que não é dígito, então funciona mesmo
 * colando um valor já formatado como "1.250,90".
 */
export function mascaraMoeda(valorDigitado) {
  const somenteDigitos = (valorDigitado || '').replace(/\D/g, '');
  if (!somenteDigitos) return '';
  const numero = Number(somenteDigitos) / 100;
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dataPorExtenso(data) {
  const texto = data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Nome de exibição da pessoa logada: usa o nome cadastrado no
 * perfil (ex: "Jeferson"). Se o perfil ainda não carregou ou não
 * tem nome salvo, usa a parte antes do @ do e-mail como reserva
 * (nunca mostra o e-mail completo na tela).
 */
export function nomeExibicao(perfil, usuario) {
  if (perfil?.nome) return perfil.nome;
  const prefixo = usuario?.email?.split('@')[0] || '';
  return prefixo.charAt(0).toUpperCase() + prefixo.slice(1);
}

/**
 * Acha a posição (0 ou 1) de um nome dentro da lista de pessoas da
 * família, ignorando maiúsculas/minúsculas e espaços nas pontas —
 * o nome salvo no perfil (login) e o nome salvo na família podem
 * ter sido digitados com pequenas diferenças de formatação.
 */
export function posicaoDaPessoa(pessoas, nome) {
  const normalizar = (texto) => (texto || '').trim().toLowerCase();
  return pessoas.findIndex((pessoa) => normalizar(pessoa) === normalizar(nome));
}

export function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function nomeMesAno(data) {
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
