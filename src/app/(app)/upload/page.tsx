import { listWarehouses } from '@/server/repositories/warehouse-repository';
import { listSnapshotsForWarehouse } from '@/server/repositories/snapshot-repository';
import { listInboundCountsByWarehouseAndDate } from '@/server/repositories/inbound-repository';
import { listHolidays } from '@/server/repositories/holiday-repository';
import { UploadCalendar } from '@/components/upload/upload-calendar';
import { dateOnlyToString } from '@/lib/date';
import { auth } from '@/server/auth';

export default async function UploadPage() {
  const session = await auth();
  const isAdmin = session?.user.role === 'ADMIN';
  const warehouses = await listWarehouses();
  const inboundCounts = await listInboundCountsByWarehouseAndDate();
  const holidays = await listHolidays();

  const calendarEntries = (
    await Promise.all(
      warehouses.map(async (w) => {
        const snapshots = await listSnapshotsForWarehouse(w.id);
        return snapshots.map((s) => {
          const date = dateOnlyToString(s.snapshotDate);
          return {
            warehouseId: w.id,
            warehouseCode: w.code,
            warehouseName: w.name,
            date,
            rowCount: s.rowCount,
            uploadedByName: s.uploadedBy.name,
            uploadedAt: s.uploadedAt.toISOString(),
            inboundCount: inboundCounts.get(`${w.id}|${date}`) ?? 0,
          };
        });
      }),
    )
  ).flat();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">재고 스냅샷 업로드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          캘린더에서 날짜·창고 칸을 눌러 재고 Excel(.xls, .xlsx)을 업로드하세요.
        </p>
      </div>
      <UploadCalendar
        warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        entries={calendarEntries}
        holidays={holidays.map((h) => ({ date: h.date, name: h.name }))}
        isAdmin={isAdmin}
      />
    </div>
  );
}
