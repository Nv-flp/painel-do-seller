export const TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export const formatBRL = (v) => brl.format(v ?? 0);
export const formatBRLShort = (v) => brlShort.format(v ?? 0);
export const formatPct = (v) => pct.format(v ?? 0);

export function formatDateTime(date) {
  return new Date(date).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// "YYYY-MM-DD" no fuso de Brasília
export const dayKey = (date) => new Date(date).toLocaleDateString("en-CA", { timeZone: TZ });
// "YYYY-MM"
export const monthKey = (date) => dayKey(date).slice(0, 7);

// O Brasil não tem horário de verão desde 2019: UTC-3 o ano todo
export const startOfMonth = (ym) => new Date(`${ym}-01T00:00:00-03:00`);

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthName(ym) {
  const name = startOfMonth(ym).toLocaleDateString("pt-BR", { timeZone: TZ, month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const ORDER_STATUS = { paid: "Pago", cancelled: "Cancelado", confirmed: "Confirmado", payment_required: "Aguardando pagamento" };

export const SHIPPING_STATUS = {
  pending: "Pendente",
  handling: "Em preparação",
  ready_to_ship: "A despachar",
  shipped: "A caminho",
  delivered: "Entregue",
  not_delivered: "Não entregue",
  cancelled: "Cancelado",
};
