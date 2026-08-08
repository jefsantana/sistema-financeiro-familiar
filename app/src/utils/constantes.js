export const PESSOAS = ['Jeferson', 'Raquel'];

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/entradas', label: 'Entradas', icon: 'TrendingUp' },
  { path: '/gastos', label: 'Gastos', icon: 'TrendingDown' },
  { path: '/categorias', label: 'Categorias', icon: 'Tag' },
  { path: '/contas', label: 'Contas Fixas', icon: 'FileText' },
  { path: '/parcelamentos', label: 'Parcelamentos', icon: 'Layers' },
  { path: '/cartoes', label: 'Cartões', icon: 'CreditCard' },
  { path: '/metas', label: 'Metas', icon: 'Target' },
  { path: '/relatorios', label: 'Relatórios', icon: 'BarChart3' },
  { path: '/historico', label: 'Histórico', icon: 'History' },
  { path: '/lixeira', label: 'Lixeira', icon: 'Trash2' },
  { path: '/configuracoes', label: 'Configurações', icon: 'Settings' },
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
