import { listWarehouses } from '@/server/repositories/warehouse-repository';
import { getSettings } from '@/server/repositories/settings-repository';
import { getInventoryRows } from '@/server/services/inventory-analysis-service';
import { loadDailyWarehouseTotals } from '@/server/repositories/inventory-repository';
import { getLatestActiveSnapshot } from '@/server/repositories/snapshot-repository';
import { todayKstDateString, dateOnlyToString } from '@/lib/date';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { auth } from '@/server/auth';

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const today = todayKstDateString();
  const mode = params.mode === 'range' ? 'range' : 'day';
  const requestedTo = isDateString(params.to) ? params.to : isDateString(params.date) ? params.date : today;
  const asOfDate = requestedTo > today ? today : requestedTo;
  const requestedFrom = isDateString(params.from) ? params.from : asOfDate;
  const fromDate = requestedFrom > asOfDate ? asOfDate : requestedFrom;
  const [session, warehouses, settings, rows, dailyTotals] = await Promise.all([
    auth(),
    listWarehouses(),
    getSettings(),
    getInventoryRows({ asOfDate, compareFromDate: mode === 'range' ? fromDate : undefined }),
    loadDailyWarehouseTotals(),
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
    />
  );
}
