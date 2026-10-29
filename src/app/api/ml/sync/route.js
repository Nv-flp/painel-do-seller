import { getCurrentAccount } from "@/lib/account";
import { syncOrders } from "@/lib/ml";
import { redirectTo } from "@/lib/http";

export async function POST(request) {
  const account = await getCurrentAccount();
  if (account.isDemo) return redirectTo(request, "/", { erro: "a conta demo não sincroniza com o Mercado Livre." });

  try {
    const total = await syncOrders(account);
    return redirectTo(request, "/", { ok: `${total} pedidos sincronizados.` });
  } catch (err) {
    return redirectTo(request, "/", { erro: err.message });
  }
}
