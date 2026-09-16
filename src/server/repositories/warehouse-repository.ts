import { prisma } from '@/lib/prisma';

export function listWarehouses() {
  return prisma.warehouse.findMany({ orderBy: { sortOrder: 'asc' } });
}

export function getWarehouseByCode(code: string) {
  return prisma.warehouse.findUnique({ where: { code } });
}

export function getWarehouseById(id: string) {
  return prisma.warehouse.findUnique({ where: { id } });
}
