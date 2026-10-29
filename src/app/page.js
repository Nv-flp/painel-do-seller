import RevenueChart from "@/components/RevenueChart";
import { getCurrentAccount, getSessionAccount } from "@/lib/account";
import { getDashboard } from "@/lib/metrics";
import { saveGoal } from "./actions";
import {
  ORDER_STATUS,
  SHIPPING_STATUS,
  formatBRL,
  formatBRLShort,
  formatDateTime,
  formatPct,
  monthName,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function Variation({ value, inverse = false, points = false }) {
  if (value === null || value === undefined) return <span className="var neutral">sem comparação</span>;
  const good = inverse ? value <= 0 : value >= 0;
  const sign = value > 0 ? "+" : "";
  const text = points ? `${sign}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : `${sign}${formatPct(value)}`;
  return (
    <span className={`var ${good ? "up" : "down"}`}>
      {text} <span className="var-note">vs. mês passado</span>
    </span>
  );
}

function Kpi({ label, value, children }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {children}
    </div>
  );
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const [account, session] = await Promise.all([getCurrentAccount(), getSessionAccount()]);
  const { kpis, daily, goal, alerts, topProducts, recentOrders } = await getDashboard(account.id);
  const hasMl = Boolean(process.env.ML_CLIENT_ID);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">PS</span>
          <div>
            <h1>Painel do Seller</h1>
            <p className="sub">
              {account.nickname}
              {account.isDemo ? <span className="pill demo">dados de demonstração</span> : <span className="pill live">Mercado Livre</span>}
            </p>
          </div>
        </div>
        <div className="actions">
          {account.lastSyncAt && (
            <span className="sync-info">{account.isDemo ? "Gerado" : "Sincronizado"} em {formatDateTime(account.lastSyncAt)}</span>
          )}
          {!account.isDemo && (
            <form action="/api/ml/sync" method="post">
              <button className="btn" type="submit">Sincronizar</button>
            </form>
          )}
          {!account.isDemo && (
            <a className="btn ghost" href="/api/conta?modo=demo">Ver demo</a>
          )}
          {account.isDemo && session && (
            <a className="btn" href="/api/conta?modo=minha">Voltar para {session.nickname}</a>
          )}
          {account.isDemo && !session && hasMl && (
            <a className="btn" href="/api/ml/login">Conectar Mercado Livre</a>
          )}
        </div>
      </header>

      {params?.erro && <p className="banner error">Não foi possível concluir: {params.erro}</p>}
      {params?.ok && <p className="banner ok">{params.ok}</p>}

      <section className="kpis" aria-label="Indicadores do mês">
        <Kpi label={`Faturamento · ${monthName(goal.month)}`} value={formatBRL(kpis.revenue)}>
          <Variation value={kpis.revenueVar} />
        </Kpi>
        <Kpi label="Pedidos pagos" value={kpis.orders.toLocaleString("pt-BR")}>
          <Variation value={kpis.ordersVar} />
        </Kpi>
        <Kpi label="Ticket médio" value={formatBRL(kpis.avgTicket)}>
          <Variation value={kpis.avgTicketVar} />
        </Kpi>
        <Kpi label="Cancelamentos" value={formatPct(kpis.cancelRate)}>
          <Variation value={kpis.cancelRateDiff} inverse points />
        </Kpi>
      </section>

      <div className="grid-main">
        <section className="card">
          <div className="card-head">
            <h2>Faturamento por dia</h2>
            <span className="muted">últimos 30 dias</span>
          </div>
          <RevenueChart data={daily} />
        </section>

        <section className="card goal">
          <div className="card-head">
            <h2>Meta do mês</h2>
            <span className="muted">{goal.daysLeft} dias restantes</span>
          </div>
          {goal.amount ? (
            <>
              <div className="goal-numbers">
                <strong>{formatPct(goal.progress)}</strong>
                <span>
                  {formatBRLShort(kpis.revenue)} de {formatBRLShort(goal.amount)}
                </span>
              </div>
              <div className="meter" role="progressbar" aria-valuenow={Math.round(goal.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${Math.min(goal.progress, 1) * 100}%` }} />
                <b style={{ left: `${Math.min(goal.projection / goal.amount, 1) * 100}%` }} title="Projeção" />
              </div>
              <p className={goal.projection >= goal.amount ? "proj good" : "proj bad"}>
                No ritmo atual o mês fecha em <strong>{formatBRLShort(goal.projection)}</strong>
                {goal.projection >= goal.amount ? ": meta batida." : `, faltariam ${formatBRLShort(goal.amount - goal.projection)}.`}
              </p>
            </>
          ) : (
            <p className="muted">Nenhuma meta definida para este mês.</p>
          )}
          <form action={saveGoal} className="goal-form">
            <input type="hidden" name="month" value={goal.month} />
            <label htmlFor="goal-amount">{goal.amount ? "Alterar meta (R$)" : "Definir meta (R$)"}</label>
            <div className="row">
              <input id="goal-amount" name="amount" type="number" min="1" step="any" defaultValue={goal.amount ?? ""} required />
              <button className="btn" type="submit">Salvar</button>
            </div>
          </form>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Alertas</h2>
          <span className="muted">{alerts.length ? `${alerts.length} ${alerts.length === 1 ? "ponto" : "pontos"} de atenção` : "tudo em ordem"}</span>
        </div>
        {alerts.length ? (
          <ul className="alerts">
            {alerts.map((a) => (
              <li key={a.title} className={`alert ${a.level}`}>
                <strong>{a.title}</strong>
                <span>{a.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nenhum envio atrasado, reclamação ou meta em risco.</p>
        )}
      </section>

      <div className="grid-two">
        <section className="card">
          <div className="card-head">
            <h2>Produtos mais vendidos</h2>
            <span className="muted">no mês</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Produto</th><th className="num">Unid.</th><th className="num">Faturamento</th></tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.itemId}>
                    <td>{p.title}</td>
                    <td className="num">{p.units}</td>
                    <td className="num">{formatBRL(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Pedidos recentes</h2>
          </div>
          <div className="table-wrap">
            <table className="orders">
              <thead>
                <tr><th>Pedido</th><th>Data</th><th>Envio</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="mono">{o.id}</span>
                      {o.status === "cancelled" && <span className="pill bad">{ORDER_STATUS.cancelled}</span>}
                    </td>
                    <td>{formatDateTime(o.createdAt)}</td>
                    <td>{SHIPPING_STATUS[o.shippingStatus] ?? o.shippingStatus ?? "—"}</td>
                    <td className="num">{formatBRL(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="foot">
        Projeto de portfólio. Dados do Mercado Livre lidos pela API oficial; a conta demo usa pedidos fictícios.
      </footer>
    </div>
  );
}
