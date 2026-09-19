import type { ValidationIssue } from './types';

export const EXPIRATION_FIELDS = ['productCode', 'productName', 'lot', 'expirationDate'] as const;
export type ExpirationField = (typeof EXPIRATION_FIELDS)[number];

export const EXPIRATION_REQUIRED_FIELDS: ExpirationField[] = ['productCode', 'expirationDate'];

export const EXPIRATION_HEADER_ALIASES: Record<ExpirationField, string[]> = {
  productCode: ['상품코드', '상품 코드', 'SKU', 'SKU코드'],
  productName: ['상품명', '상품 명', '제품명'],
  lot: ['롯트', '로트', '로트번호', '롯트번호', 'LOT', 'Lot'],
  expirationDate: ['유통기한', '소비기한'],
};

/** 한 행 = 한 로트. 같은 상품코드가 여러 행에 걸쳐 있으면 로트별로 각각 반영된다.
 *  lot이 비어 있으면(null) 소비기한 오름차순으로 A, B, C…가 자동으로 매겨진다. */
export interface ParsedExpirationRow {
  rowNumber: number;
  productCode: string;
  productName: string | null;
  lot: string | null;
  expirationDate: string; // 'yyyy-MM-dd'
}

export interface ExpirationParseResult {
  rows: ParsedExpirationRow[];
  issues: ValidationIssue[];
}
