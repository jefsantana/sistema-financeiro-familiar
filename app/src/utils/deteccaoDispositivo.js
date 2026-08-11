// Leitura simples do user-agent do navegador — o suficiente pra
// mostrar "Chrome • Windows" no histórico de acessos, sem precisar de
// nenhuma biblioteca externa.
export function detectarDispositivo(userAgent = navigator.userAgent) {
  let navegador = 'Navegador desconhecido';
  if (/Edg\//.test(userAgent)) navegador = 'Edge';
  else if (/OPR\/|Opera/.test(userAgent)) navegador = 'Opera';
  else if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) navegador = 'Chrome';
  else if (/Firefox\//.test(userAgent)) navegador = 'Firefox';
  else if (/Safari\//.test(userAgent) && !/Chrome/.test(userAgent)) navegador = 'Safari';

  let sistema = 'Sistema desconhecido';
  if (/Windows/.test(userAgent)) sistema = 'Windows';
  else if (/Mac OS X/.test(userAgent) && !/iPhone|iPad/.test(userAgent)) sistema = 'macOS';
  else if (/Android/.test(userAgent)) sistema = 'Android';
  else if (/iPhone|iPad|iPod/.test(userAgent)) sistema = 'iOS';
  else if (/Linux/.test(userAgent)) sistema = 'Linux';

  const dispositivo = /Mobi|Android|iPhone|iPad/.test(userAgent) ? 'mobile' : 'desktop';

  return { navegador, sistema, dispositivo };
}
