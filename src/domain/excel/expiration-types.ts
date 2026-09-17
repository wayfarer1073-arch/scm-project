import type { ValidationIssue } from './types';

export const EXPIRATION_FIELDS = ['productCode', 'productName', 'expirationDate'] as const;
export type ExpirationField = (typeof EXPIRATION_FIELDS)[number];

export const EXPIRATION_REQUIRED_FIELDS: ExpirationField[] = ['productCode', 'expirationDate'];

export const EXPIRATION_HEADER_ALIASES: Record<ExpirationField, string[]> = {
  productCode: ['상품코드', '상품 코드', 'SKU', 'SKU코드'],
  productName: ['상품명', '상품 명', '제품명'],
  expirationDate: ['유통기한', '소비기한'],
};

/** productCode당 하나 — 같은 상품에 여러 로트가 있으면 가장 이른(soonest) 소비기한을 대표값으로 쓴다. */
export interface ParsedExpirationRow {
  rowNumber: number;
  productCode: string;
  productName: string | null;
  expirationDate: string; // 'yyyy-MM-dd'
}

export interface ExpirationParseResult {
  rows: ParsedExpirationRow[];
  issues: ValidationIssue[];
}
