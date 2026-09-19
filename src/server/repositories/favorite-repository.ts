import { prisma } from '@/lib/prisma';

export async function listFavoriteSkuIds(userId: string): Promise<string[]> {
  const rows = await prisma.skuFavorite.findMany({ where: { userId }, select: { skuId: true } });
  return rows.map((r) => r.skuId);
}

export async function addFavorite(userId: string, skuId: string): Promise<void> {
  await prisma.skuFavorite.upsert({
    where: { userId_skuId: { userId, skuId } },
    update: {},
    create: { userId, skuId },
  });
}

export async function removeFavorite(userId: string, skuId: string): Promise<void> {
  await prisma.skuFavorite.deleteMany({ where: { userId, skuId } });
}
