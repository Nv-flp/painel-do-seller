// Cliente da API oficial do Mercado Livre: OAuth, renovação de token e sincronização de pedidos.
// Documentação: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
import { randomBytes } from "node:crypto";
import { prisma } from "./db";

const API = "https://api.mercadolibre.com";
const AUTH = "https://auth.mercadolivre.com.br/authorization";

const DAY = 24 * 60 * 60 * 1000;
const SYNC_DAYS = 90;
const PAGE_SIZE = 50;

function config() {
  const { ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI } = process.env;
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URI) {
    throw new Error("Configure ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI");
  }
  return { clientId: ML_CLIENT_ID, clientSecret: ML_CLIENT_SECRET, redirectUri: ML_REDIRECT_URI };
}

export function authorizationUrl(state) {
  const { clientId, redirectUri } = config();
  const url = new URL(AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params) {
  const { clientId, clientSecret } = config();
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `Erro ${res.status} ao obter token`);
  return data;
}

// Troca o "code" do callback por tokens e salva a conta
export async function connectAccount(code) {
  const { redirectUri } = config();
  const token = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  const me = await apiGet("/users/me", token.access_token);

  const data = {
    nickname: me.nickname,
    sessionToken: randomBytes(32).toString("hex"),
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
  };
  return prisma.account.upsert({
    where: { id: String(token.user_id) },
    update: data,
    create: { id: String(token.user_id), ...data },
  });
}

// O access token dura 6 horas; renova com 5 minutos de folga
async function validToken(account) {
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return account.accessToken;
  }
  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: account.refreshToken });
  await prisma.account.update({
    where: { id: account.id },
    data: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    },
  });
  return token.access_token;
}

async function apiGet(path, accessToken, extraHeaders = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...extraHeaders },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status} em ${path}`);
  return data;
}

// Prazo de despacho: o formato do envio varia, então procura nos campos conhecidos
function handlingLimitOf(shipment) {
  const candidates = [
    shipment?.lead_time?.estimated_handling_limit?.date,
    shipment?.shipping_option?.estimated_handling_limit?.date,
    shipment?.estimated_handling_limit?.date,
  ];
  const found = candidates.find(Boolean);
  return found ? new Date(found) : null;
}

async function fetchShipment(shippingId, accessToken) {
  try {
    return await apiGet(`/shipments/${shippingId}`, accessToken, { "x-format-new": "true" });
  } catch {
    return null; // sem permissão ou envio fora do Mercado Envios
  }
}

function mapOrder(order, shipment) {
  return {
    id: String(order.id),
    status: order.status,
    totalAmount: Number(order.total_amount ?? 0),
    createdAt: new Date(order.date_created),
    buyerNickname: order.buyer?.nickname ?? null,
    shippingStatus: shipment?.status ?? null,
    handlingLimit: handlingLimitOf(shipment),
    hasClaim: Array.isArray(order.mediations) && order.mediations.length > 0,
    items: (order.order_items ?? []).map((oi) => ({
      itemId: String(oi.item?.id ?? ""),
      title: oi.item?.title ?? "Item",
      quantity: Number(oi.quantity ?? 1),
      unitPrice: Number(oi.unit_price ?? 0),
    })),
  };
}

// Busca os pedidos dos últimos 90 dias e grava no banco
export async function syncOrders(account) {
  const accessToken = await validToken(account);
  const from = new Date(Date.now() - SYNC_DAYS * DAY).toISOString();

  let offset = 0;
  let total = Infinity;
  let synced = 0;

  while (offset < total) {
    const qs = new URLSearchParams({
      seller: account.id,
      "order.date_created.from": from,
      sort: "date_desc",
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    const page = await apiGet(`/orders/search?${qs}`, accessToken);
    total = page.paging?.total ?? 0;

    for (const order of page.results ?? []) {
      const shipment = order.shipping?.id ? await fetchShipment(order.shipping.id, accessToken) : null;
      const { items, ...data } = mapOrder(order, shipment);

      await prisma.$transaction([
        prisma.order.upsert({
          where: { id: data.id },
          update: data,
          create: { ...data, accountId: account.id },
        }),
        prisma.orderItem.deleteMany({ where: { orderId: data.id } }),
        prisma.orderItem.createMany({ data: items.map((it) => ({ ...it, orderId: data.id })) }),
      ]);
      synced++;
    }

    if (!page.results?.length) break;
    offset += PAGE_SIZE;
  }

  await prisma.account.update({ where: { id: account.id }, data: { lastSyncAt: new Date() } });
  return synced;
}
