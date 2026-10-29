import { NextResponse } from "next/server";

// Atrás de proxy (Railway), request.url pode trazer o host interno;
// quando a URI de redirect está configurada, usa a origem dela.
export function appUrl(request, path) {
  const origin = process.env.ML_REDIRECT_URI ? new URL(process.env.ML_REDIRECT_URI).origin : new URL(request.url).origin;
  return new URL(path, origin);
}

// 303 faz o navegador voltar com GET depois de um POST
export function redirectTo(request, path, params = {}) {
  const url = appUrl(request, path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
