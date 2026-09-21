import { expect, it } from 'vitest';
import { attachIntervalInbounds } from './inbounds';
import type { StockObservation } from './types';

const observation = (date: string, availableStock = 100): StockObservation => ({ date, availableStock, normalStock: availableStock,
  defectiveStock: 0, incomingStock: 0, unitCost: 1, warningQty: 0, dangerQty: 0 });

it('uses open-left/closed-right intervals for entries that already land inside an interval', () => {
  const rows = ['2026-09-10', '2026-09-12', '2026-09-15'].map((d) => observation(d));
  const result = attachIntervalInbounds(rows, [
    { date: '2026-09-09', quantity: 999 }, // before the very first observation — unclaimed, no effect either way
    { date: '2026-09-11', quantity: 30 }, { date: '2026-09-12', quantity: 20 },
    { date: '2026-09-15', quantity: 40 },
  ]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 50, 40]);
  expect(rows.every((r) => r.inboundQuantity === undefined)).toBe(true);
});

it('handles no observations and no inbound entries', () => {
  expect(attachIntervalInbounds([], [{ date: '2026-09-10', quantity: 50 }])).toEqual([]);
  expect(attachIntervalInbounds([observation('2026-09-10')], [])[0].inboundQuantity).toBe(0);
});

it('credits an inbound registered one business day AFTER the latest observation (late registration grace period)', () => {
  // 2026-09-16/17 are both weekdays (Wed/Thu), so the next shipping day is the plain calendar next day.
  const rows = [observation('2026-09-16', 100), observation('2026-09-17', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-18', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 648]);
});

it('does not grace an inbound registered two or more business days after the latest observation', () => {
  const rows = [observation('2026-09-16', 100), observation('2026-09-17', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-19', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 0]);
});

it('reassigns an inbound registered one business day EARLY to the next interval when the earlier interval had no increase to explain', () => {
  // 9/16→9/17 stock is flat (100→100): the 9/16-dated inbound explains nothing there.
  // 9/17→9/18 is where the real +648 jump was observed, exactly the next business day.
  const rows = [observation('2026-09-16', 100), observation('2026-09-17', 100), observation('2026-09-18', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-17', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 0, 648]);
});

it('does NOT reassign an early-dated inbound when its own interval genuinely needed it too', () => {
  // 9/16→9/17 itself increased by 300, so the entry legitimately explains that interval —
  // it must not be stolen away just because a later interval also increased.
  const rows = [observation('2026-09-16', 100), observation('2026-09-17', 400), observation('2026-09-18', 1048)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-17', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 648, 0]);
});

it('does NOT reassign across a gap larger than one business day — the entry stays with its strict (correct) interval', () => {
  const rows = [observation('2026-09-10', 100), observation('2026-09-12', 100), observation('2026-09-18', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-12', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 648, 0]);
});

it('does not reassign when the next interval has nothing to explain either', () => {
  const rows = [observation('2026-09-16', 100), observation('2026-09-17', 100), observation('2026-09-18', 100)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-17', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 648, 0]);
});

it('reassigns across a weekend when uploads only happen on business days (2026-09-18 Fri → 2026-09-21 Mon)', () => {
  // Registration lands on Friday, the interval ending Friday is flat, and the real jump only
  // shows up in Monday's snapshot (Sat/Sun are skipped entirely — no upload happens then).
  // A raw ±1 CALENDAR day tolerance would have missed this (Mon is 3 calendar days after Fri);
  // the ±1 BUSINESS day tolerance must still catch it.
  const rows = [observation('2026-09-17', 100), observation('2026-09-18', 100), observation('2026-09-21', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-18', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 0, 648]);
});

it('credits a late registration made on the next business day across a weekend (Fri observation, Mon registration)', () => {
  const rows = [observation('2026-09-17', 100), observation('2026-09-18', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-21', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 648]);
});

it('does not grace a registration two business days after the latest observation, even across a weekend', () => {
  const rows = [observation('2026-09-17', 100), observation('2026-09-18', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-22', quantity: 648 }]);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 0]);
});

it('treats a configured holiday like a non-shipping day when computing the ±1 business day window', () => {
  // 2026-09-21 (Mon) is declared a holiday, so the next shipping day after Friday 9/18 becomes
  // Tuesday 9/22 instead of Monday — the registration on 9/22 should now be graced, not 9/21.
  const holidays = new Set(['2026-09-21']);
  const rows = [observation('2026-09-17', 100), observation('2026-09-18', 748)];
  const result = attachIntervalInbounds(rows, [{ date: '2026-09-22', quantity: 648 }], holidays);
  expect(result.map((r) => r.inboundQuantity)).toEqual([0, 648]);
});
