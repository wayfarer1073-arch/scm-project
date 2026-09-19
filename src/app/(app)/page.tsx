import { listWarehouses } from '@/server/repositories/warehouse-repository';
import { getSettings } from '@/server/repositories/settings-repository';
import { getInventoryRows } from '@/server/services/inventory-analysis-service';
import { loadDailyWarehouseTotals } from '@/server/repositories/inventory-repository';
import { getLatestActiveSnapshot } from '@/server/repositories/snapshot-repository';
import { listHolidayDateStrings } from '@/server/repositories/holiday-repository';
import { listFavoriteSkuIds } from '@/server/repositories/favorite-repository';
import { todayKstDateString, dateOnlyToString, isDateString } from '@/lib/date';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { auth } from '@/server/auth';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const today = todayKstDateString();
  const mode = params.mode === 'range' ? 'range' : 'day';
  const requestedTo = isDateString(params.to) ? params.to : isDateString(params.date) ? params.date : today;
  const asOfDate = requestedTo > today ? today : requestedTo;
  const requestedFrom = isDateString(params.from) ? params.from : asOfDate;
  const fromDate = requestedFrom > asOfDate ? asOfDate : requestedFrom;
  const settings = await getSettings();
  const session = await auth();
  const [warehouses, rows, dailyTotals, holidays, favoriteSkuIds] = await Promise.all([
    listWarehouses(),
    getInventoryRows({ asOfDate, compareFromDate: mode === 'range' ? fromDate : undefined, settings }),
    loadDailyWarehouseTotals(asOfDate),
    listHolidayDateStrings(),
    session?.user.id ? listFavoriteSkuIds(session.user.id) : Promise.resolve([]),
  ]);
  const isAdmin = session?.user.role === 'ADMIN';

  const latestUploads = await Promise.all(
    warehouses.map(async (w) => {
      const latest = await getLatestActiveSnapshot(w.id);
      return {
        warehouseId: w.id,
        snapshotDate: latest ? dateOnlyToString(latest.snapshotDate) : null,
        uploadedAt: latest ? latest.uploadedAt.toISOString() : null,
      };
    }),
  );

  return (
    <DashboardClient
      asOfDate={asOfDate}
      fromDate={mode === 'range' ? fromDate : null}
      warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
      settings={settings}
      rows={rows}
      dailyTotals={dailyTotals}
      latestUploads={latestUploads}
      isAdmin={isAdmin}
      holidays={holidays}
      favoriteSkuIds={favoriteSkuIds}
    />
  );
}
