import { MODE_COOKIE } from "@/lib/account";
import { cookieOptions, redirectTo } from "@/lib/http";

// Alterna entre a demo e a conta conectada: /api/conta?modo=demo ou ?modo=minha
export async function GET(request) {
  const mode = new URL(request.url).searchParams.get("modo");
  const res = redirectTo(request, "/");
  if (mode === "demo") res.cookies.set(MODE_COOKIE, "demo", { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  else res.cookies.delete(MODE_COOKIE);
  return res;
}
