import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, formatSigned } from '@/lib/format';
import type { CompanyKpis } from '@/server/services/inventory-analysis-service';

interface KpiCardsProps {
  kpis: CompanyKpis;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const items: { label: string; value: string; sub?: string }[] = [
    { label: '관리 SKU 수', value: `${formatNumber(kpis.totalSkuCount)}개` },
    { label: '총 가용재고', value: `${formatNumber(kpis.totalAvailableStock)}개` },
    { label: '총 재고자산', value: formatCurrency(kpis.totalInventoryValue), sub: '정상재고 × 원가 기준' },
    {
      label: '전일 대비 순재고 증감',
      value: kpis.netChangeVsYesterday === null ? '데이터 축적 중' : `${formatSigned(kpis.netChangeVsYesterday)}개`,
    },
    { label: '최근 7일 추정 소진량', value: `${formatNumber(kpis.totalDepletion7d)}개` },
    { label: '위험 SKU 수', value: `${formatNumber(kpis.dangerSkuCount)}개` },
    { label: '30일 내 소진 예상 SKU 수', value: `${formatNumber(kpis.stockoutSoon30dCount)}개` },
    { label: '장기 정체재고 금액', value: formatCurrency(kpis.stagnantValue) },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-semibold tabular-nums">{item.value}</div>
            {item.sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{item.sub}</div>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
