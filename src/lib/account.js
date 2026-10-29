import { cookies } from "next/headers";
import { prisma } from "./db";
import { DEMO_ACCOUNT_ID, resetDemo } from "./demo";

// "sessao" guarda um token aleatório da conta conectada (nunca o id do vendedor),
// "modo=demo" permite olhar a demo sem perder a sessão.
export const SESSION_COOKIE = "sessao";
export const MODE_COOKIE = "modo";

const DEMO_MAX_AGE = 24 * 60 * 60 * 1000;

export async function getSessionAccount() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return prisma.account.findUnique({ where: { sessionToken: token } });
}

// Conta exibida no painel: a conectada, ou a demo como padrão.
// A demo é criada num deploy novo e regenerada a cada dia, para os pedidos
// fictícios sempre chegarem até hoje.
export async function getCurrentAccount() {
  const store = await cookies();
  const session = await getSessionAccount();
  if (session && store.get(MODE_COOKIE)?.value !== "demo") return session;

  let demo = await prisma.account.findUnique({ where: { id: DEMO_ACCOUNT_ID } });
  if (!demo || Date.now() - demo.lastSyncAt.getTime() > DEMO_MAX_AGE) {
    try {
      await resetDemo(prisma);
    } catch (err) {
      // Outra requisição pode estar gerando a demo ao mesmo tempo
      console.error("Falha ao gerar a conta demo:", err.message);
    }
    demo = await prisma.account.findUnique({ where: { id: DEMO_ACCOUNT_ID } });
  }
  return demo;
}
