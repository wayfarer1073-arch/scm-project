import { listWarehouses } from '@/server/repositories/warehouse-repository';
import { getSettings } from '@/server/repositories/settings-repository';
import { getInventoryRows } from '@/server/services/inventory-analysis-service';
import { loadDailyWarehouseTotals } from '@/server/repositories/inventory-repository';
import { todayKstDateString } from '@/lib/date';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export default async function DashboardPage() {
  const asOfDate = todayKstDateString();
  const [warehouses, settings, rows, dailyTotals] = await Promise.all([
    listWarehouses(),
    getSettings(),
    getInventoryRows({ asOfDate }),
    loadDailyWarehouseTotals(),
  ]);

  return (
    <DashboardClient
      asOfDate={asOfDate}
      warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
      settings={settings}
      rows={rows}
      dailyTotals={dailyTotals}
    />
  );
}
