import { useCategorias } from '../../contexts/CategoriasContext.jsx';

export function CategoriaComIcone({ nome }) {
  const { iconesGasto, iconesEntrada } = useCategorias();
  if (!nome) return '-';
  const Icone = iconesGasto[nome] || iconesEntrada[nome];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Icone && <Icone size={14} style={{ color: 'var(--cor-primaria)', flexShrink: 0 }} />}
      {nome}
    </span>
  );
}
