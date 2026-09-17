import type { CompanyKpis, InventoryValueBreakdown, SkuAnalysis, WarehouseSummary } from '@/domain/inventory/types';

/** Excel export는 분석된 결과만 내보낸다(원본 파일 재다운로드 아님). 이 모듈은 시트별 row 배열(순수 객체)만 만든다 — 실제 파일 I/O는 얇은 wrapper에서 처리한다. */

export interface ExportRowInput {
  productCode: string;
  productName: string;
  warehouseName: string;
  analysis: SkuAnalysis;
  valueBreakdown: InventoryValueBreakdown;
}

function riskLabelOf(level: SkuAnalysis['thresholdRisk']['level']): string {
  if (level === 'DANGER') return '위험';
  if (level === 'WARNING') return '주의';
  return '정상';
}

export function buildInventorySheetRows(rows: ExportRowInput[]): Record<string, string | number>[] {
  return rows.map((r) => ({
    상품코드: r.productCode,
    상품명: r.productName,
    창고: r.warehouseName,
    현재가용재고: r.analysis.latest.availableStock,
    정상재고: r.analysis.latest.normalStock,
    전일대비: r.analysis.dailyChange ?? '',
    '최근7일소진량': r.analysis.window7.totalDepletion,
    '최근7일입고반영량': r.analysis.window7.totalInboundQuantity ?? 0,
    '최근7일일평균소진': r.analysis.window7.averageDailyDepletion ?? '',
    '7일vs이전7일변화율(%)': r.analysis.acceleration.accelerationRatePercent ?? '',
    'Coverage(일)': r.analysis.coverage.coverageDays ?? (r.analysis.coverage.band === null && r.analysis.maturity.hasSevenDayData ? '소진없음' : ''),
    예상소진일: r.analysis.forecast.expectedStockoutDate ?? '데이터축적중',
    단위원가: r.analysis.latest.unitCost,
    재고금액: r.valueBreakdown.normalStockValue,
    정체일수: r.analysis.stagnation.isMeaningful ? r.analysis.stagnation.stagnantDays : '',
    상태: riskLabelOf(r.analysis.thresholdRisk.level),
    태그: r.analysis.tags.join(' '),
  }));
}

export function buildRiskSheetRows(rows: ExportRowInput[]): Record<string, string | number>[] {
  return buildInventorySheetRows(rows.filter((r) => r.analysis.thresholdRisk.level !== 'NORMAL' || r.analysis.coverage.band === 'STOCKOUT_SOON'));
}

export function buildStagnantSheetRows(rows: ExportRowInput[]): Record<string, string | number>[] {
  return buildInventorySheetRows(rows.filter((r) => r.analysis.tags.some((t) => t.startsWith('[재고 정체'))));
}

export function buildSummarySheetRows(kpis: CompanyKpis, warehouseSummaries: WarehouseSummary[]): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [
    { 항목: '관리 SKU 수', 값: kpis.totalSkuCount },
    { 항목: '총 가용재고', 값: kpis.totalAvailableStock },
    { 항목: '총 재고자산', 값: kpis.totalInventoryValue },
    // 여러 창고를 합산할 때 창고마다 최근 업로드일이 달라 "전일"이 아니라 "각 SKU의 직전 관측치
    // 대비" 값일 수 있다 — 대시보드 KPI 카드(periodLabel)와 동일하게 날짜 수에 대해 정직한 라벨을 쓴다.
    { 항목: '직전 관측 대비 순재고 증감', 값: kpis.netChangeVsYesterday ?? '데이터축적중' },
    { 항목: '최근 7일 추정 소진량', 값: kpis.totalDepletion7d },
    { 항목: '위험 SKU 수', 값: kpis.dangerSkuCount },
    { 항목: '30일 내 소진 예상 SKU 수', 값: kpis.stockoutSoon30dCount },
    { 항목: '장기 정체재고 금액', 값: kpis.stagnantValue },
    { 항목: '', 값: '' },
  ];
  for (const w of warehouseSummaries) {
    rows.push({
      항목: `[${w.warehouseName}] 관리 SKU / 재고자산 / 위험 SKU / 위험비율`,
      값: `${w.skuCount} / ${w.inventoryValue} / ${w.dangerSkuCount} / ${Math.round(w.dangerRatio * 100)}%`,
    });
  }
  return rows;
}

export interface ExportEventInput {
  eventDate: string;
  warehouseName: string;
  productName: string | null;
  eventType: string;
  quantity: number | null;
  note: string;
  createdByName: string;
}

export function buildEventsSheetRows(events: ExportEventInput[]): Record<string, string | number>[] {
  return events.map((e) => ({
    일시: e.eventDate,
    창고: e.warehouseName,
    상품: e.productName ?? '(창고 전체)',
    유형: e.eventType,
    수량: e.quantity ?? '',
    내용: e.note,
    작성자: e.createdByName,
  }));
}
