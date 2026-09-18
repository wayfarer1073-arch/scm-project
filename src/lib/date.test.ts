import { describe, expect, it } from 'vitest';
import { isDateString } from './date';
describe('query date validation', () => {
  it('rejects invalid calendar dates and non-string query values', () => {
    for (const value of ['2026-02-30', '2026-13-01', '2026-00-01', '', null, ['2026-09-01']]) expect(isDateString(value)).toBe(false);
    for (const value of ['2024-02-29', '2026-09-18']) expect(isDateString(value)).toBe(true);
  });
});
