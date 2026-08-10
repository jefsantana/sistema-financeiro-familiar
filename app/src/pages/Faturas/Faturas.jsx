import { Receipt, Layers, ShoppingBag } from 'lucide-react';
import { Card, Badge, EmptyState, Loading, InfoBanner } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { formatarMoeda } from '../../utils/formatadores.js';
import { agruparComprasPorFatura, nomeDoMes } from '../../utils/financeiro.js';
import formStyles from '../_shared/CrudPage.module.css';
import styles from './Faturas.module.css';

export default function Faturas() {
  const { registros: cartoes, carregando: c1 } = useCrudMock('Cartoes');
  const { registros: comprasCartao, carregando: c2 } = useCrudMock('ComprasCartao');
  const carregando = c1 || c2;

  if (carregando) return <Loading texto="Carregando faturas..." />;

  if (cartoes.length === 0) {
    return (
      <EmptyState
        icone={Receipt}
        titulo="Nenhum cartão cadastrado"
        descricao="Cadastre um cartão na tela Cartões pra acompanhar as faturas aqui."
      />
    );
  }

  return (
    <div>
      <div className={formStyles.cabecalhoPagina}>
        <Receipt size={20} className={formStyles.iconePagina} />
        <h1>Fatura do Cartão</h1>
      </div>

      <InfoBanner>
        Resumo de tudo que foi comprado no cartão de crédito, à vista ou parcelado, separado por fatura. Pra pagar a
        fatura em aberto, use os "Próximos Vencimentos" no Dashboard.
      </InfoBanner>

      {cartoes.map((cartao) => {
        const faturas = agruparComprasPorFatura(comprasCartao.filter((c) => c.cartao === cartao.nome));

        return (
          <section key={cartao.id} className={styles.secaoCartao}>
            <h3 className={styles.tituloCartao}>{cartao.nome}</h3>

            {faturas.length === 0 ? (
              <p className={styles.semCompras}>Nenhuma compra registrada neste cartão ainda.</p>
            ) : (
              <div className={styles.listaFaturas}>
                {faturas.map((fatura) => (
                  <Card key={fatura.mesFatura} className={styles.cardFatura}>
                    <div className={styles.linhaTopoFatura}>
                      <span className={styles.mesFatura}>{nomeDoMes(fatura.mesFatura, 'long')}</span>
                      <Badge cor={fatura.paga ? 'sucesso' : 'alerta'}>{fatura.paga ? 'Paga' : 'Em aberto'}</Badge>
                    </div>

                    <p className={styles.totalFatura}>{formatarMoeda(fatura.valorTotal)}</p>

                    <p className={styles.resumoTipos}>
                      {fatura.totalAVista > 0 && `${formatarMoeda(fatura.totalAVista)} à vista`}
                      {fatura.totalAVista > 0 && fatura.totalParcelado > 0 && ' · '}
                      {fatura.totalParcelado > 0 && `${formatarMoeda(fatura.totalParcelado)} parcelado`}
                    </p>

                    <ul className={styles.itensFatura}>
                      {fatura.itens.map((item) => {
                        const IconeItem = item.parcelado ? Layers : ShoppingBag;
                        return (
                          <li key={item.id}>
                            <span className={styles.descricaoItem}>
                              <IconeItem size={13} /> {item.descricao}
                            </span>
                            <span>{formatarMoeda(item.valor)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
