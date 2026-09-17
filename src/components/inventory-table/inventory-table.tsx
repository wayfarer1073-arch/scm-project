'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileSpreadsheet, Search, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCoverageDays, formatCurrency, formatNumber, formatSigned } from '@/lib/format';
import { formatKstDate } from '@/lib/date';
import { riskBadgeVariant, riskLabel } from '@/lib/status';
import { TABLE_TABS, matchesQuickFilter, matchesTab, type QuickFilter, type TableTab } from '@/lib/inventory-filters';
import { buildInventorySheetRows, type ExportRowInput } from '@/domain/excel/export';
import { downloadSheetsAsExcel } from '@/lib/xlsx-download';
import type { InventoryRow } from '@/server/services/inventory-analysis-service';

interface InventoryTableProps {
  rows: InventoryRow[];
  warehouses: { id: string; code: string; name: string }[];
  warehouseFilter: string | 'ALL';
  onChangeWarehouseFilter: (id: string | 'ALL') => void;
  tab: TableTab;
  onChangeTab: (tab: TableTab) => void;
  quickFilter: QuickFilter;
  onClearQuickFilter: () => void;
  onSelectSku: (skuId: string) => void;
  asOfDate: string;
  fromDate: string | null;
}

type SortKey = 'stockoutFast' | 'coverageAsc' | 'depletionRateDesc' | 'accelerationDesc' | 'valueDesc' | 'stagnantDesc' | 'increaseDesc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'stockoutFast', label: '예상 소진 빠른 순' },
  { value: 'coverageAsc', label: 'Coverage 낮은 순' },
  { value: 'depletionRateDesc', label: '소진속도 높은 순' },
  { value: 'accelerationDesc', label: '소진 가속률 높은 순' },
  { value: 'valueDesc', label: '재고금액 높은 순' },
  { value: 'stagnantDesc', label: '정체일수 높은 순' },
  { value: 'increaseDesc', label: '전일 증가량 높은 순' },
];

const PAGE_SIZE = 25;

function sortValue(row: InventoryRow, key: SortKey): number | null {
  switch (key) {
    case 'stockoutFast':
      return row.analysis.forecast.expectedStockoutDays;
    case 'coverageAsc':
      return row.analysis.coverage.coverageDays;
    case 'depletionRateDesc':
      return row.analysis.window7.averageDailyDepletion;
    case 'accelerationDesc':
      return row.analysis.acceleration.accelerationRatePercent;
    case 'valueDesc':
      return row.valueBreakdown.normalStockValue;
    case 'stagnantDesc':
      return row.analysis.stagnation.isMeaningful ? row.analysis.stagnation.stagnantDays : null;
    case 'increaseDesc':
      return row.periodComparison
        ? row.periodComparison.totalIncrease
        : row.analysis.dailyChange !== null && row.analysis.dailyChange > 0 ? row.analysis.dailyChange : null;
    default:
      return null;
  }
}

const ASCENDING_BY_DEFAULT: SortKey[] = ['stockoutFast', 'coverageAsc'];

export function InventoryTable({
  rows,
  warehouses,
  warehouseFilter,
  onChangeWarehouseFilter,
  tab,
  onChangeTab,
  quickFilter,
  onClearQuickFilter,
  onSelectSku,
  asOfDate,
  fromDate,
}: InventoryTableProps) {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'DANGER' | 'WARNING' | 'NORMAL'>('ALL');
  const [coverageMin, setCoverageMin] = useState('');
  const [coverageMax, setCoverageMax] = useState('');
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [trendFilter, setTrendFilter] = useState<'ALL' | 'ACCELERATING' | 'DECELERATING'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('coverageAsc');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (warehouseFilter !== 'ALL' && r.descriptor.warehouseId !== warehouseFilter) return false;
      if (!matchesTab(r.analysis, tab)) return false;
      if (!matchesQuickFilter(r.analysis, quickFilter)) return false;
      if (q && !r.descriptor.productName.toLowerCase().includes(q) && !r.descriptor.productCode.toLowerCase().includes(q)) return false;
      if (riskFilter !== 'ALL' && r.analysis.thresholdRisk.level !== riskFilter) return false;
      if (coverageMin && (r.analysis.coverage.coverageDays === null || r.analysis.coverage.coverageDays < Number(coverageMin))) return false;
      if (coverageMax && (r.analysis.coverage.coverageDays === null || r.analysis.coverage.coverageDays > Number(coverageMax))) return false;
      if (costMin && r.analysis.latest.unitCost < Number(costMin)) return false;
      if (costMax && r.analysis.latest.unitCost > Number(costMax)) return false;
      if (trendFilter !== 'ALL' && r.analysis.acceleration.trend !== trendFilter) return false;
      return true;
    });
  }, [rows, warehouseFilter, tab, quickFilter, search, riskFilter, coverageMin, coverageMax, costMin, costMax, trendFilter]);

  const sorted = useMemo(() => {
    const withValue = filtered.map((r) => ({ row: r, value: sortValue(r, sortKey) }));
    withValue.sort((a, b) => {
      if (a.value === null && b.value === null) return 0;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return sortAsc ? a.value - b.value : b.value - a.value;
    });
    return withValue.map((w) => w.row);
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(ASCENDING_BY_DEFAULT.includes(key));
    }
    setPage(1);
  }

  function downloadCurrentView() {
    const exportRows: ExportRowInput[] = sorted.map((r) => ({
      productCode: r.descriptor.productCode,
      productName: r.descriptor.productName,
      warehouseName: r.descriptor.warehouseName,
      analysis: r.analysis,
      valueBreakdown: r.valueBreakdown,
    }));
    downloadSheetsAsExcel([{ name: '조회결과', rows: buildInventorySheetRows(exportRows) }], `재고_조회결과_${asOfDate}.xlsx`);
  }

  return (
    <section className="scroll-mt-20 space-y-3 rounded-2xl border bg-card p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.65)] sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">전체 재고 현황</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">행을 선택하면 최근 추이와 주요 KPI를 확인할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{sorted.length.toLocaleString('ko-KR')}건</span>
          <Button variant="outline" size="sm" onClick={downloadCurrentView}>
            <Download className="size-3.5" /> 현재 조회결과 다운로드
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/export/full-report?asOf=${asOfDate}`}>
              <FileSpreadsheet className="size-3.5" /> 전체 재고 리포트
            </a>
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          onChangeTab(v as TableTab);
          setPage(1);
        }}
      >
        <TabsList>
          {TABLE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {quickFilter && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">Action Center 필터 적용됨</Badge>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onClearQuickFilter}>
            <X className="size-3" /> 필터 해제
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="상품명/상품코드 검색"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-8 w-48 pl-7 text-xs"
          />
        </div>

        <Select value={warehouseFilter} onValueChange={(v) => onChangeWarehouseFilter(v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="창고" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 창고</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as typeof riskFilter)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="위험 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">위험 상태 전체</SelectItem>
            <SelectItem value="DANGER">위험</SelectItem>
            <SelectItem value="WARNING">주의</SelectItem>
            <SelectItem value="NORMAL">정상</SelectItem>
          </SelectContent>
        </Select>

        <Select value={trendFilter} onValueChange={(v) => setTrendFilter(v as typeof trendFilter)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="소진속도" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">소진속도 전체</SelectItem>
            <SelectItem value="ACCELERATING">가속만</SelectItem>
            <SelectItem value="DECELERATING">둔화만</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Coverage
          <Input value={coverageMin} onChange={(e) => setCoverageMin(e.target.value)} placeholder="min" className="h-8 w-16 text-xs" inputMode="numeric" />
          ~
          <Input value={coverageMax} onChange={(e) => setCoverageMax(e.target.value)} placeholder="max" className="h-8 w-16 text-xs" inputMode="numeric" />
          일
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          원가
          <Input value={costMin} onChange={(e) => setCostMin(e.target.value)} placeholder="min" className="h-8 w-20 text-xs" inputMode="numeric" />
          ~
          <Input value={costMax} onChange={(e) => setCostMax(e.target.value)} placeholder="max" className="h-8 w-20 text-xs" inputMode="numeric" />
        </div>

        <Select value={sortKey} onValueChange={(v) => toggleSort(v as SortKey)}>
          <SelectTrigger className="ml-auto h-8 text-xs"><SelectValue placeholder="정렬" /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>상품코드</TableHead>
              <TableHead className="min-w-[220px]">상품명</TableHead>
              <TableHead>창고</TableHead>
              <TableHead className="text-right">가용재고</TableHead>
              <TableHead className="hidden text-right 2xl:table-cell">정상재고</TableHead>
              <SortableHead label={fromDate ? '기간 변화' : '전일 대비'} active={sortKey === 'increaseDesc'} asc={sortAsc} onClick={() => toggleSort('increaseDesc')} />
              <TableHead className="hidden text-right xl:table-cell">7일 소진량</TableHead>
              <SortableHead className="hidden 2xl:table-cell" label="7일 일평균 소진" active={sortKey === 'depletionRateDesc'} asc={sortAsc} onClick={() => toggleSort('depletionRateDesc')} />
              <SortableHead label="7일 vs 이전 변화율" active={sortKey === 'accelerationDesc'} asc={sortAsc} onClick={() => toggleSort('accelerationDesc')} />
              <SortableHead label="Coverage" active={sortKey === 'coverageAsc'} asc={sortAsc} onClick={() => toggleSort('coverageAsc')} />
              <SortableHead label="예상 소진일" active={sortKey === 'stockoutFast'} asc={sortAsc} onClick={() => toggleSort('stockoutFast')} />
              <TableHead className="hidden text-right 2xl:table-cell">단위원가</TableHead>
              <SortableHead label="재고금액" active={sortKey === 'valueDesc'} asc={sortAsc} onClick={() => toggleSort('valueDesc')} />
              <SortableHead className="hidden xl:table-cell" label="정체일수" active={sortKey === 'stagnantDesc'} asc={sortAsc} onClick={() => toggleSort('stagnantDesc')} />
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="h-24 text-center text-sm text-muted-foreground">
                  조건에 맞는 재고가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => (
              <TableRow
                key={r.descriptor.skuId}
                tabIndex={0}
                role="button"
                aria-label={`${r.descriptor.productName} 상세 보기`}
                onClick={() => onSelectSku(r.descriptor.skuId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSelectSku(r.descriptor.skuId);
                  }
                }}
                className="cursor-pointer outline-none focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <TableCell className="font-mono text-xs text-muted-foreground">{r.descriptor.productCode}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.descriptor.productName}</div>
                  {r.analysis.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.analysis.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>{r.descriptor.warehouseCode}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.analysis.latest.availableStock)}</TableCell>
                <TableCell className="hidden text-right tabular-nums 2xl:table-cell">{formatNumber(r.analysis.latest.normalStock)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fromDate ? (
                    r.periodComparison ? (
                      <div>
                        <span className={r.periodComparison.netChange > 0 ? 'text-status-increase' : r.periodComparison.netChange < 0 ? 'text-status-warning' : ''}>
                          {formatSigned(r.periodComparison.netChange)}
                        </span>
                        <div className="text-[10px] text-muted-foreground">감소 {formatNumber(r.periodComparison.totalDepletion)} · 증가 {formatNumber(r.periodComparison.totalIncrease)}</div>
                      </div>
                    ) : <span className="text-muted-foreground">비교 불가</span>
                  ) : r.analysis.dailyChange === null ? <span className="text-muted-foreground">데이터 축적 중</span> : formatSigned(r.analysis.dailyChange)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums xl:table-cell">{formatNumber(r.analysis.window7.totalDepletion)}</TableCell>
                <TableCell className="hidden text-right tabular-nums 2xl:table-cell">
                  {r.analysis.window7.averageDailyDepletion === null ? '-' : formatNumber(r.analysis.window7.averageDailyDepletion)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.analysis.acceleration.accelerationRatePercent === null ? (
                    <span className="text-muted-foreground">{r.analysis.acceleration.trend === 'NEW_DEPLETION' ? '신규 소진' : '-'}</span>
                  ) : (
                    <span className={r.analysis.acceleration.trend === 'ACCELERATING' ? 'text-status-danger' : r.analysis.acceleration.trend === 'DECELERATING' ? 'text-status-increase' : ''}>
                      {formatSigned(r.analysis.acceleration.accelerationRatePercent)}%
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCoverageDays(r.analysis.coverage.coverageDays)}</TableCell>
                <TableCell className="text-right text-xs">
                  {r.analysis.forecast.expectedStockoutDate ? formatKstDate(r.analysis.forecast.expectedStockoutDate) : <span className="text-muted-foreground">데이터 축적 중</span>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums 2xl:table-cell">{formatNumber(r.analysis.latest.unitCost)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.valueBreakdown.normalStockValue)}</TableCell>
                <TableCell className="hidden text-right tabular-nums xl:table-cell">
                  {r.analysis.stagnation.isMeaningful ? `${r.analysis.stagnation.stagnantDays}일` : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={riskBadgeVariant(r.analysis.thresholdRisk.level)}>{riskLabel(r.analysis.thresholdRisk.level)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            이전
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            다음
          </Button>
        </div>
      )}
    </section>
  );
}

function SortableHead({ label, active, asc, onClick, className }: { label: string; active: boolean; asc: boolean; onClick: () => void; className?: string }) {
  return (
    <TableHead className={`text-right ${className ?? ''}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {active ? asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </TableHead>
  );
}
