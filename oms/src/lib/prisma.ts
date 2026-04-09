import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** 与 schema 中企业管理相关 model 是否已生成到当前 PrismaClient 上 */
function hasEnterpriseDelegates(client: PrismaClient): boolean {
  const c = client as unknown as {
    enterpriseRecord?: unknown;
    enterpriseImportBatch?: unknown;
  };
  return typeof c.enterpriseRecord !== "undefined" && typeof c.enterpriseImportBatch !== "undefined";
}

function createPrisma(): PrismaClient {
  return new PrismaClient();
}

function resolvePrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached) {
    if (process.env.NODE_ENV !== "production" && !hasEnterpriseDelegates(cached)) {
      void cached.$disconnect().catch(() => {});
      const next = createPrisma();
      globalForPrisma.prisma = next;
      return next;
    }
    return cached;
  }

  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = resolvePrisma();
