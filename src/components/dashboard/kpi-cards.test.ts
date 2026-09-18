import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KpiCards } from './kpi-cards';
import { calculateCompanyKpis } from '@/domain/inventory/aggregation';

describe('KPI display uncertainty', () => {
  it('renders unavailable valuation and comparisons without inventing zero totals', () => {
    const html = renderToStaticMarkup(createElement(KpiCards, {
      kpis: calculateCompanyKpis([], 30), asOfDate: '2026-09-18', fromDate: null,
    }));
    expect(html).toContain('평가 불가');
    expect(html).toContain('비교 불가');
    expect(html).toContain('산정 불가');
    expect(html).not.toContain('30일 내 소진 예상');
  });
  it('states exact endpoint requirements for the selected range', () => {
    const html = renderToStaticMarkup(createElement(KpiCards, {
      kpis: calculateCompanyKpis([], 30, '2026-09-01'), asOfDate: '2026-09-18', fromDate: '2026-09-01',
    }));
    expect(html).toContain('2026-09-01 — 2026-09-18 양 끝 관측 일치');
    expect(html).toContain('보유율은 주문 충족률이 아닙니다');
  });
});
