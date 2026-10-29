import { PrismaClient } from "@prisma/client";
import { resetDemo } from "../src/lib/demo.js";

const prisma = new PrismaClient();

const total = await resetDemo(prisma);
console.log(`Conta demo criada com ${total} pedidos.`);
await prisma.$disconnect();
