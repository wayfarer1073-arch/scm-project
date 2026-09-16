import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

export function listUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true, name: true, role: true, createdAt: true } });
}

export async function createUser(input: { email: string; name: string; password: string; role: Role }) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: { email: input.email.trim().toLowerCase(), name: input.name, passwordHash, role: input.role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}
