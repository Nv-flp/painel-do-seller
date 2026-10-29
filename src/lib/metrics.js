import { prisma } from "./db";
import { dayKey, daysInMonth, formatPct, monthKey, shiftMonth, startOfMonth } from "./format";

const DAY = 24 * 60 * 60 * 1000;

// Limites dos alertas
export const CANCEL_RATE_LIMIT = 0.03; // 3% de cancelamento nos últimos 30 dias
const NOT_SHIPPED = ["pending", "handling", "ready_to_ship"];

function summarize(orders) {
  const paid = orders.filter((o) => o.status !== "cancelled");
  const revenue = paid.reduce((s, o) => s + o.totalAmount, 0);
  const cancelled = orders.length - paid.length;
  return {
    revenue,
    orders: paid.length,
    avgTicket: paid.length ? revenue / paid.length : 0,
    cancelRate: orders.length ? cancelled / orders.length : 0,
  };
}

function variation(current, previous) {
  if (!previous) return null;
  return (current - previous) / previous;
}

export async function getDashboard(accountId, now = new Date()) {
  const month = monthKey(now);
  const monthStart = startOfMonth(month);
  const prevStart = startOfMonth(shiftMonth(month, -1));
  const elapsed = now.getTime() - monthStart.getTime();
  const last30Start = new Date(now.getTime() - 30 * DAY);
  const from = new Date(Math.min(prevStart.getTime(), last30Start.getTime()));

  const [orders, goal] = await Promise.all([
    prisma.order.findMany({
      where: { accountId, createdAt: { gte: from, lte: now } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.goal.findUnique({ where: { accountId_month: { accountId, month } } }),
  ]);

  const current = orders.filter((o) => o.createdAt >= monthStart);
  // Mesmo período do mês passado, para comparar de forma justa
  const previous = orders.filter((o) => o.createdAt >= prevStart && o.createdAt.getTime() < prevStart.getTime() + elapsed);
  const last30 = orders.filter((o) => o.createdAt >= last30Start);

  const cur = summarize(current);
  const prev = summarize(previous);

  const kpis = {
    ...cur,
    revenueVar: variation(cur.revenue, prev.revenue),
    ordersVar: variation(cur.orders, prev.orders),
    avgTicketVar: variation(cur.avgTicket, prev.avgTicket),
    cancelRateDiff: cur.cancelRate - prev.cancelRate,
  };

  // Faturamento por dia nos últimos 30 dias
  const byDay = new Map();
  for (let t = now.getTime() - 29 * DAY; t <= now.getTime(); t += DAY) {
    byDay.set(dayKey(new Date(t)), { day: dayKey(new Date(t)), revenue: 0, orders: 0 });
  }
  for (const o of last30) {
    const row = byDay.get(dayKey(o.createdAt));
    if (row && o.status !== "cancelled") {
      row.revenue += o.totalAmount;
      row.orders += 1;
    }
  }
  const daily = [...byDay.values()].map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }));

  // Meta do mês e projeção no ritmo atual
  const totalDays = daysInMonth(month);
  const elapsedDays = Math.max(elapsed / DAY, 1);
  const projection = (cur.revenue / elapsedDays) * totalDays;
  const goalInfo = {
    month,
    amount: goal?.amount ?? null,
    progress: goal ? cur.revenue / goal.amount : null,
    projection,
    daysLeft: Math.max(0, Math.ceil(totalDays - elapsed / DAY)),
  };

  // Alertas
  const lateShipments = last30.filter(
    (o) => o.status !== "cancelled" && NOT_SHIPPED.includes(o.shippingStatus) && o.handlingLimit && o.handlingLimit < now
  );
  const claims = last30.filter((o) => o.hasClaim);
  const last30Summary = summarize(last30);

  const alerts = [];
  if (lateShipments.length) {
    alerts.push({
      level: "critical",
      title: `${lateShipments.length} ${lateShipments.length === 1 ? "envio atrasado" : "envios atrasados"}`,
      detail: `Passaram do prazo de despacho: ${lateShipments.map((o) => o.id).join(", ")}. Atraso derruba a reputação.`,
    });
  }
  if (claims.length) {
    alerts.push({
      level: "warning",
      title: `${claims.length} ${claims.length === 1 ? "reclamação" : "reclamações"} nos últimos 30 dias`,
      detail: `Pedidos: ${claims.map((o) => o.id).join(", ")}.`,
    });
  }
  if (last30Summary.cancelRate > CANCEL_RATE_LIMIT) {
    alerts.push({
      level: "warning",
      title: "Cancelamentos acima do limite",
      detail: `${formatPct(last30Summary.cancelRate)} nos últimos 30 dias (limite: ${formatPct(CANCEL_RATE_LIMIT)}).`,
    });
  }
  if (goal && projection < goal.amount) {
    alerts.push({
      level: "warning",
      title: "Meta do mês em risco",
      detail: `No ritmo atual o mês fecha em ${Math.round((projection / goal.amount) * 100)}% da meta.`,
    });
  }

  // Produtos mais vendidos no mês
  const products = new Map();
  for (const o of current) {
    if (o.status === "cancelled") continue;
    for (const it of o.items) {
      const p = products.get(it.itemId) ?? { itemId: it.itemId, title: it.title, units: 0, revenue: 0 };
      p.units += it.quantity;
      p.revenue += it.quantity * it.unitPrice;
      products.set(it.itemId, p);
    }
  }
  const topProducts = [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const recentOrders = orders.slice(0, 8);

  return { kpis, daily, goal: goalInfo, alerts, topProducts, recentOrders };
}
