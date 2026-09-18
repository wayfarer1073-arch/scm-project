import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { auth } from '@/server/auth';
import { getInventoryRows } from '@/server/services/inventory-analysis-service';
import { calculateCompanyKpis, calculateWarehouseSummaries } from '@/domain/inventory/aggregation';
import { listAllEvents } from '@/server/repositories/event-repository';
import { getSettings } from '@/server/repositories/settings-repository';
import { buildEventsSheetRows, buildInventorySheetRows, buildRiskSheetRows, buildStagnantSheetRows, buildSummarySheetRows, type ExportRowInput } from '@/domain/excel/export';
import { formatKstDateTime } from '@/lib/date';
import { todayKstDateString } from '@/lib/date';
import { eventTypeLabel } from '@/lib/event-types';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const url = new URL(request.url);
  const asOfDate = url.searchParams.get('asOf') ?? todayKstDateString();

  const [rows, events, settings] = await Promise.all([getInventoryRows({ asOfDate }), listAllEvents(), getSettings()]);
  const kpis = calculateCompanyKpis(rows, settings.stagnantDays);
  const warehouseSummaries = calculateWarehouseSummaries(rows, settings.stagnantDays);

  const exportRows: ExportRowInput[] = rows.map((r) => ({
    productCode: r.descriptor.productCode,
    productName: r.descriptor.productName,
    warehouseName: r.descriptor.warehouseName,
    analysis: r.analysis,
    valueBreakdown: r.valueBreakdown,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummarySheetRows(kpis, warehouseSummaries)), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildInventorySheetRows(exportRows)), 'Inventory');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildRiskSheetRows(exportRows)), 'Risk');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildStagnantSheetRows(exportRows)), 'Stagnant');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      buildEventsSheetRows(
        events.map((e) => ({
          eventDate: formatKstDateTime(e.eventDate),
          warehouseName: e.warehouse.name,
          productName: e.sku?.currentProductName ?? null,
          eventType: eventTypeLabel(e.eventType),
          quantity: e.quantity,
          note: e.note,
          createdByName: e.createdBy.name,
        })),
      ),
    ),
    'Events',
  );

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const filename = `재고_전체리포트_${asOfDate}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Content-Disposition 헤더는 ByteString이어야 하므로 한글 파일명은 RFC 5987 형식으로 인코딩한다.
      'Content-Disposition': `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
