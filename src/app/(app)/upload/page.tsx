import { listWarehouses } from '@/server/repositories/warehouse-repository';
import { listSnapshotsForWarehouse } from '@/server/repositories/snapshot-repository';
import { UploadCalendar } from '@/components/upload/upload-calendar';
import { dateOnlyToString } from '@/lib/date';

export default async function UploadPage() {
  const warehouses = await listWarehouses();

  const calendarEntries = (
    await Promise.all(
      warehouses.map(async (w) => {
        const snapshots = await listSnapshotsForWarehouse(w.id);
        return snapshots.map((s) => ({
          warehouseId: w.id,
          warehouseCode: w.code,
          warehouseName: w.name,
          date: dateOnlyToString(s.snapshotDate),
          rowCount: s.rowCount,
          uploadedByName: s.uploadedBy.name,
          uploadedAt: s.uploadedAt.toISOString(),
          inboundEntries: s.inboundEntries.map((entry) => ({
            productIdentifier: entry.productCode,
            productName: entry.productName,
            quantity: String(entry.quantity),
          })),
        }));
      }),
    )
  ).flat();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">재고 스냅샷 업로드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          캘린더에서 날짜·창고 칸을 눌러 재고 Excel(.xls, .xlsx)을 업로드하세요. 각 창고는 서로 다른 품목군을 관리하는 독립 재고 Pool입니다.
        </p>
      </div>
      <UploadCalendar warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))} entries={calendarEntries} />
    </div>
  );
}
