import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, Button } from '../../components/ui/index.js';

export default function NaoEncontrado() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState
        icone={Compass}
        titulo="Página não encontrada"
        descricao="O endereço que você tentou acessar não existe."
        acao={
          <Link to="/dashboard">
            <Button>Voltar ao Dashboard</Button>
          </Link>
        }
      />
    </div>
  );
}
