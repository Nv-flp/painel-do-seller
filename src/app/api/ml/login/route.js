import { randomBytes } from "node:crypto";
import { authorizationUrl } from "@/lib/ml";
import { cookieOptions, redirectTo } from "@/lib/http";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // "state" aleatório protege o callback contra requisições forjadas
    const state = randomBytes(16).toString("hex");
    const res = NextResponse.redirect(authorizationUrl(state));
    res.cookies.set("ml_state", state, { ...cookieOptions, maxAge: 600 });
    return res;
  } catch (err) {
    return redirectTo(request, "/", { erro: err.message });
  }
}
