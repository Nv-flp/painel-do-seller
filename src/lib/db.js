import { PrismaClient } from "@prisma/client";

// Reaproveita a conexão entre recarregamentos no modo de desenvolvimento
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
