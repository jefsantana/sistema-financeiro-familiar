export function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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
