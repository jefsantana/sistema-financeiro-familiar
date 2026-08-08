import { ICONES_CATEGORIA_GASTO } from '../../utils/icones.js';

export function CategoriaComIcone({ nome }) {
  if (!nome) return '-';
  const Icone = ICONES_CATEGORIA_GASTO[nome];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Icone && <Icone size={14} style={{ color: 'var(--cor-primaria)', flexShrink: 0 }} />}
      {nome}
    </span>
  );
}
