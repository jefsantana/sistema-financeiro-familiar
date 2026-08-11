import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { listar } from '../services/dados.js';
import { useAuth } from './AuthContext.jsx';
import { CATEGORIAS_GASTO_FIXAS, CATEGORIAS_ENTRADA_FIXAS } from '../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO, ICONES_CATEGORIA_ENTRADA, ICONES_DISPONIVEIS } from '../utils/icones.js';

const CategoriasContext = createContext(null);

function combinar(tipo, fixas, customizadas) {
  const extras = customizadas.filter((c) => c.tipo === tipo && !fixas.includes(c.nome));
  return { nomes: [...fixas, ...extras.map((c) => c.nome)], extras };
}

export function CategoriasProvider({ children }) {
  const { perfil } = useAuth();
  const [customizadas, setCustomizadas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = async () => {
    setCarregando(true);
    try {
      const dados = await listar('Categorias');
      setCustomizadas(dados);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (perfil?.familia_id) recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.familia_id]);

  const valor = useMemo(() => {
    const gasto = combinar('gasto', CATEGORIAS_GASTO_FIXAS, customizadas);
    const entrada = combinar('entrada', CATEGORIAS_ENTRADA_FIXAS, customizadas);

    const iconesGasto = { ...ICONES_CATEGORIA_GASTO };
    gasto.extras.forEach((c) => {
      iconesGasto[c.nome] = ICONES_DISPONIVEIS[c.icone] || ICONES_DISPONIVEIS.Tag;
    });

    const iconesEntrada = { ...ICONES_CATEGORIA_ENTRADA };
    entrada.extras.forEach((c) => {
      iconesEntrada[c.nome] = ICONES_DISPONIVEIS[c.icone] || ICONES_DISPONIVEIS.Tag;
    });

    return {
      categoriasGasto: gasto.nomes,
      categoriasEntrada: entrada.nomes,
      iconesGasto,
      iconesEntrada,
      customizadas,
      carregando,
      recarregar,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customizadas, carregando]);

  return <CategoriasContext.Provider value={valor}>{children}</CategoriasContext.Provider>;
}

export function useCategorias() {
  const contexto = useContext(CategoriasContext);
  if (!contexto) throw new Error('useCategorias precisa estar dentro de um CategoriasProvider');
  return contexto;
}
