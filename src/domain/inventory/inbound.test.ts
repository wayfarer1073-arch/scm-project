import { describe, expect, it } from 'vitest';
import { resolveInboundEntries } from './inbound';

const products = [
  { productCode: '001', productName: '상품 A' },
  { productCode: '002', productName: '상품 B' },
  { productCode: '003', productName: '상품 B' },
];

describe('resolveInboundEntries', () => {
  it('상품코드와 고유한 상품명을 매칭하고 같은 SKU 수량을 합친다', () => {
    expect(resolveInboundEntries([
      { productIdentifier: '001', quantity: 10 },
      { productIdentifier: '상품 A', quantity: 5 },
    ], products)).toEqual({ ok: true, entries: [{ productCode: '001', productName: '상품 A', quantity: 15 }] });
  });

  it('중복 상품명은 상품코드 입력을 요구한다', () => {
    const result = resolveInboundEntries([{ productIdentifier: '상품 B', quantity: 10 }], products);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('여러 상품코드');
  });

  it('업로드 파일에 없는 상품과 잘못된 수량을 거부한다', () => {
    const result = resolveInboundEntries([
      { productIdentifier: '없는 상품', quantity: 10 },
      { productIdentifier: '001', quantity: 1.5 },
    ], products);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });

  it('같은 SKU의 합산 수량이 DB 정수 범위를 넘으면 거부한다', () => {
    const result = resolveInboundEntries([
      { productIdentifier: '001', quantity: 2_147_483_647 },
      { productIdentifier: '001', quantity: 1 },
    ], products);
    expect(result.ok).toBe(false);
  });
});
