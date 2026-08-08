export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', grupo: 'Principal' },
  { path: '/entradas', label: 'Entradas', icon: 'TrendingUp', grupo: 'Movimentações' },
  { path: '/gastos', label: 'Gastos', icon: 'TrendingDown', grupo: 'Movimentações' },
  { path: '/categorias', label: 'Categorias', icon: 'Tag', grupo: 'Movimentações' },
  { path: '/contas', label: 'Contas Fixas', icon: 'FileText', grupo: 'Movimentações' },
  { path: '/parcelamentos', label: 'Parcelamentos', icon: 'Layers', grupo: 'Movimentações' },
  { path: '/cartoes', label: 'Cartões', icon: 'CreditCard', grupo: 'Movimentações' },
  { path: '/metas', label: 'Metas', icon: 'Target', grupo: 'Planejamento' },
  { path: '/relatorios', label: 'Relatórios', icon: 'BarChart3', grupo: 'Planejamento' },
  { path: '/historico', label: 'Histórico', icon: 'History', grupo: 'Planejamento' },
  { path: '/lixeira', label: 'Lixeira', icon: 'Trash2', grupo: 'Sistema' },
  { path: '/configuracoes', label: 'Configurações', icon: 'Settings', grupo: 'Sistema' },
];

export const NAV_ITEMS_MOBILE = [
  { path: '/dashboard', label: 'Início', icon: 'LayoutDashboard' },
  { path: '/historico', label: 'Histórico', icon: 'History' },
  { path: '/relatorios', label: 'Relatórios', icon: 'BarChart3' },
  { path: '/configuracoes', label: 'Ajustes', icon: 'Settings' },
];

export const CORES_GRAFICO = ['#7B61FF', '#FF7A9C', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

export const STATUS_LANCAMENTO = {
  pago: { label: 'Pago', cor: 'sucesso' },
  pendente: { label: 'Pendente', cor: 'alerta' },
  excluido: { label: 'Excluído', cor: 'perigo' },
};
