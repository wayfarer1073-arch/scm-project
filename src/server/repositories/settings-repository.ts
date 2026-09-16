import { prisma } from '@/lib/prisma';
import { DEFAULT_RISK_SETTINGS, type RiskThresholdSettings } from '@/domain/inventory/types';

export async function getSettings(): Promise<RiskThresholdSettings> {
  const row = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_RISK_SETTINGS },
  });
  return {
    stockoutSoonDays: row.stockoutSoonDays,
    manageMaxDays: row.manageMaxDays,
    overstockCoverageDays: row.overstockCoverageDays,
    stagnantDays: row.stagnantDays,
  };
}

export async function updateSettings(input: Partial<RiskThresholdSettings>) {
  return prisma.settings.upsert({
    where: { id: 1 },
    update: input,
    create: { id: 1, ...DEFAULT_RISK_SETTINGS, ...input },
  });
}
