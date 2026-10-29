"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentAccount } from "@/lib/account";

export async function saveGoal(formData) {
  const account = await getCurrentAccount();
  const month = String(formData.get("month"));
  const raw = String(formData.get("amount")).trim();
  // Aceita "30000", "30000.50" e o formato brasileiro "30.000,50"
  const amount = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);

  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(amount) || amount <= 0) return;

  await prisma.goal.upsert({
    where: { accountId_month: { accountId: account.id, month } },
    update: { amount },
    create: { accountId: account.id, month, amount },
  });
  revalidatePath("/");
}
