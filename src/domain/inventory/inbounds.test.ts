import { expect, it } from 'vitest';
import { attachIntervalInbounds } from './inbounds';
import type { StockObservation } from './types';

const observation = (date: string): StockObservation => ({ date, availableStock: 100, normalStock: 100,
  defectiveStock: 0, incomingStock: 0, unitCost: 1, warningQty: 0, dangerQty: 0 });

it('uses open-left/closed-right intervals and excludes unobserved leading and trailing inbound', () => {
  const rows = ['2026-09-10', '2026-09-12', '2026-09-15'].map(observation);
  const result = attachIntervalInbounds(rows, [
    { date: '2026-09-16', quantity: 999 }, { date: '2026-09-12', quantity: 20 },
    { date: '2026-09-09', quantity: 999 }, { date: '2026-09-11', quantity: 30 },
    { date: '2026-09-10', quantity: 999 }, { date: '2026-09-15', quantity: 40 },
  ]);
  expect(result.map(r => r.inboundQuantity)).toEqual([0, 50, 40]);
  expect(rows.every(r => r.inboundQuantity === undefined)).toBe(true);
});

it('handles no observations and no inbound entries', () => {
  expect(attachIntervalInbounds([], [{ date: '2026-09-10', quantity: 50 }])).toEqual([]);
  expect(attachIntervalInbounds([observation('2026-09-10')], [])[0].inboundQuantity).toBe(0);
});
