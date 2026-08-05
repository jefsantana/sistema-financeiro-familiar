export function renderConfiguracoes() {
  const temaAtual = localStorage.getItem('tema') || 'light';
  return `
    <h3>⚙️ Configurações</h3>
    <div class="formulario" style="align-items:center;">
      <div class="campo" style="flex-direction:row; align-items:center; gap: var(--espaco-sm);">
        <label for="switchTema">Modo escuro</label>
        <input type="checkbox" id="switchTema" ${temaAtual === 'dark' ? 'checked' : ''}>
      </div>
    </div>
  `;
}

export function iniciarEventosConfiguracoes(alternarTema) {
  const switchTema = document.getElementById('switchTema');
  if (!switchTema) return;

  switchTema.addEventListener('change', () => {
    alternarTema();
  });
}