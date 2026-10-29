import { cookies } from "next/headers";
import { MODE_COOKIE, SESSION_COOKIE } from "@/lib/account";
import { connectAccount, syncOrders } from "@/lib/ml";
import { cookieOptions, redirectTo } from "@/lib/http";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();

  if (!code || !state || state !== store.get("ml_state")?.value) {
    return redirectTo(request, "/", { erro: "autorização inválida ou expirada. Tente conectar de novo." });
  }

  try {
    const account = await connectAccount(code);
    const total = await syncOrders(account);
    const res = redirectTo(request, "/", { ok: `Conta ${account.nickname} conectada: ${total} pedidos sincronizados.` });
    res.cookies.set(SESSION_COOKIE, account.sessionToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 90 });
    res.cookies.delete(MODE_COOKIE);
    res.cookies.delete("ml_state");
    return res;
  } catch (err) {
    return redirectTo(request, "/", { erro: err.message });
  }
}
