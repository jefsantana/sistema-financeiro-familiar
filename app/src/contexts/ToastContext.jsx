import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ToastViewport } from '../components/ui/Toast/Toast.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const proximoId = useRef(0);

  const remover = useCallback((id) => {
    setToasts((atuais) => atuais.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback(
    (mensagem, opcoes = {}) => {
      const id = ++proximoId.current;
      const tipo = opcoes.tipo || 'sucesso';
      const duracao = opcoes.duracao ?? 3500;
      setToasts((atuais) => [...atuais, { id, mensagem, tipo }]);
      if (duracao > 0) {
        setTimeout(() => remover(id), duracao);
      }
      return id;
    },
    [remover]
  );

  const valor = useMemo(
    () => ({
      mostrar,
      sucesso: (mensagem, opcoes) => mostrar(mensagem, { ...opcoes, tipo: 'sucesso' }),
      erro: (mensagem, opcoes) => mostrar(mensagem, { ...opcoes, tipo: 'erro' }),
      remover,
    }),
    [mostrar, remover]
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <ToastViewport toasts={toasts} aoFechar={remover} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast precisa estar dentro de um ToastProvider');
  return contexto;
}
