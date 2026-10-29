// Gera uma conta de demonstração com ~120 dias de pedidos fictícios,
// sempre relativos à data de hoje, para o painel funcionar sem Mercado Livre.

export const DEMO_ACCOUNT_ID = "demo";

const PRODUCTS = [
  { itemId: "DEMO-001", title: "Fone Bluetooth com Cancelamento de Ruído", price: 189.9, weight: 5 },
  { itemId: "DEMO-002", title: "Garrafa Térmica Inox 1L", price: 79.9, weight: 8 },
  { itemId: "DEMO-003", title: "Kit Organizador de Gaveta 6 Peças", price: 49.9, weight: 7 },
  { itemId: "DEMO-004", title: "Luminária LED de Mesa Articulada", price: 119.9, weight: 4 },
  { itemId: "DEMO-005", title: "Mochila para Notebook 15,6\"", price: 159.9, weight: 4 },
  { itemId: "DEMO-006", title: "Suporte Veicular Magnético para Celular", price: 39.9, weight: 9 },
  { itemId: "DEMO-007", title: "Smartwatch Fit com Monitor Cardíaco", price: 249.9, weight: 3 },
  { itemId: "DEMO-008", title: "Mouse Sem Fio Silencioso", price: 69.9, weight: 6 },
];

const BUYERS = ["ANA.SOUZA", "CARLOSM", "JULIA_R", "PEDRO1990", "MARIANA.L", "RAFAEL_T", "BRUNA.C", "LUCASFS", "CAMILA_O", "TIAGO.R"];

// Gerador pseudoaleatório com semente fixa: os mesmos dados a cada geração
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, list) {
  const total = list.reduce((s, p) => s + p.weight, 0);
  let r = rand() * total;
  for (const p of list) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return list[list.length - 1];
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export function buildDemoOrders(now = new Date()) {
  const rand = mulberry32(2026);
  const orders = [];
  let seq = 1;

  for (let daysAgo = 120; daysAgo >= 0; daysAgo--) {
    const day = new Date(now.getTime() - daysAgo * DAY);
    const weekday = day.getDay();
    // Tendência de crescimento + fim de semana mais fraco
    const base = 6 + (120 - daysAgo) * 0.05;
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.7 : 1;
    const count = Math.max(1, Math.round(base * weekendFactor + (rand() - 0.5) * 5));

    for (let i = 0; i < count; i++) {
      // Hoje: só pedidos até a hora atual
      const offset = daysAgo === 0 ? rand() * Math.max(1, now.getHours()) * HOUR : rand() * 20 * HOUR + 2 * HOUR;
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const createdAt = new Date(Math.min(start.getTime() + offset, now.getTime() - 5 * 60 * 1000));

      const nItems = rand() < 0.85 ? 1 : 2;
      const items = [];
      for (let k = 0; k < nItems; k++) {
        const p = pickWeighted(rand, PRODUCTS);
        const quantity = rand() < 0.9 ? 1 : 2;
        items.push({ itemId: p.itemId, title: p.title, quantity, unitPrice: p.price });
      }
      const totalAmount = Math.round(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0) * 100) / 100;

      const cancelled = rand() < 0.04;
      const ageHours = (now.getTime() - createdAt.getTime()) / HOUR;
      const handlingLimit = new Date(createdAt.getTime() + 30 * HOUR);

      let shippingStatus;
      if (cancelled) shippingStatus = "cancelled";
      else if (ageHours > 120) shippingStatus = "delivered";
      else if (ageHours > 36) shippingStatus = rand() < 0.5 ? "shipped" : "delivered";
      else shippingStatus = "ready_to_ship";

      orders.push({
        id: `DEMO-${String(seq++).padStart(6, "0")}`,
        status: cancelled ? "cancelled" : "paid",
        totalAmount,
        createdAt,
        buyerNickname: BUYERS[Math.floor(rand() * BUYERS.length)],
        shippingStatus,
        handlingLimit,
        hasClaim: !cancelled && rand() < 0.015,
        items,
      });
    }
  }

  // Alguns pedidos de ontem ainda não despachados: viram "envio atrasado"
  const late = orders.filter((o) => o.status === "paid" && (now - o.createdAt) / HOUR > 32 && (now - o.createdAt) / HOUR < 60);
  late.slice(0, 3).forEach((o) => {
    o.shippingStatus = "ready_to_ship";
  });

  return orders;
}

function monthKey(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

export async function resetDemo(prisma, now = new Date()) {
  const orders = buildDemoOrders(now);

  await prisma.account.deleteMany({ where: { id: DEMO_ACCOUNT_ID } });
  await prisma.account.create({ data: { id: DEMO_ACCOUNT_ID, nickname: "LOJA DEMO", isDemo: true, lastSyncAt: now } });

  await prisma.order.createMany({
    data: orders.map(({ items, ...order }) => ({ ...order, accountId: DEMO_ACCOUNT_ID })),
  });
  await prisma.orderItem.createMany({
    data: orders.flatMap((o) => o.items.map((it) => ({ ...it, orderId: o.id }))),
  });

  // Metas: mês atual e os dois anteriores
  const goals = [];
  for (let m = 0; m < 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
    goals.push({ accountId: DEMO_ACCOUNT_ID, month: monthKey(d), amount: [42000, 32000, 26000][m] });
  }
  await prisma.goal.createMany({ data: goals });

  return orders.length;
}
