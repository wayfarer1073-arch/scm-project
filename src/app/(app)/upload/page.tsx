import { listWarehouses } from '@/server/repositories/warehouse-repository';
import { listSnapshotsForWarehouse } from '@/server/repositories/snapshot-repository';
import { listInboundCountsByWarehouseAndDate } from '@/server/repositories/inbound-repository';
import { listHolidays } from '@/server/repositories/holiday-repository';
import { listSchedules } from '@/server/repositories/schedule-repository';
import { UploadCalendar } from '@/components/upload/upload-calendar';
import { dateOnlyToString } from '@/lib/date';
import { auth } from '@/server/auth';

export default async function UploadPage() {
  const session = await auth();
  const isAdmin = session?.user.role === 'ADMIN';
  const warehouses = await listWarehouses();
  const inboundCounts = await listInboundCountsByWarehouseAndDate();
  const holidays = await listHolidays();
  const schedules = await listSchedules();

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
      <UploadCalendar
        warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        entries={calendarEntries}
        holidays={holidays.map((h) => ({ date: h.date, name: h.name }))}
        schedules={schedules}
        isAdmin={isAdmin}
      />
    </div>
  );
}
