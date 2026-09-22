import { describe, expect, it } from 'vitest';
import { buildTemplateSheet } from './templates';
import { HEADER_ALIASES, REQUIRED_FIELDS } from './types';
import { EXPIRATION_HEADER_ALIASES, EXPIRATION_REQUIRED_FIELDS } from './expiration-types';
import { PACKAGING_HEADER_ALIASES, PACKAGING_REQUIRED_FIELDS } from './packaging-types';
import { normalizeHeaderCell } from './aoa-reader';

/** 샘플 양식의 헤더가 실제 파서의 필수 컬럼을 전부 커버하는지 검증한다 — 파서 쪽 헤더 별칭이
 * 바뀌었는데 샘플 파일을 안 고치면 이 테스트가 잡아낸다. */
function assertCoversRequiredFields(headers: string[], headerAliases: Record<string, string[]>, requiredFields: string[]) {
  const normalizedHeaders = headers.map(normalizeHeaderCell);
  for (const field of requiredFields) {
    const aliases = headerAliases[field].map(normalizeHeaderCell);
    expect(aliases.some((a) => normalizedHeaders.includes(a))).toBe(true);
  }
}

describe('buildTemplateSheet', () => {
  it('inventory 템플릿이 파서의 필수 헤더(상품코드/상품명/정상재고)를 포함한다', () => {
    const sheet = buildTemplateSheet('inventory');
    assertCoversRequiredFields(sheet.headers, HEADER_ALIASES, REQUIRED_FIELDS);
    expect(sheet.rows.length).toBeGreaterThan(0);
    for (const row of sheet.rows) expect(row.length).toBe(sheet.headers.length);
  });

  it('expiration 템플릿이 파서의 필수 헤더(상품코드/소비기한)를 포함한다', () => {
    const sheet = buildTemplateSheet('expiration');
    assertCoversRequiredFields(sheet.headers, EXPIRATION_HEADER_ALIASES, EXPIRATION_REQUIRED_FIELDS);
    for (const row of sheet.rows) expect(row.length).toBe(sheet.headers.length);
  });

  it('packaging 템플릿이 파서의 필수 헤더(상품코드)를 포함한다', () => {
    const sheet = buildTemplateSheet('packaging');
    assertCoversRequiredFields(sheet.headers, PACKAGING_HEADER_ALIASES, PACKAGING_REQUIRED_FIELDS);
    for (const row of sheet.rows) expect(row.length).toBe(sheet.headers.length);
  });
});
