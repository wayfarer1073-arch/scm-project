import type { ValidationIssue } from './types';

export const PACKAGING_FIELDS = ['productCode', 'productName', 'eaPerBox', 'eaPerPallet', 'barcode'] as const;
export type PackagingField = (typeof PACKAGING_FIELDS)[number];

export const PACKAGING_REQUIRED_FIELDS: PackagingField[] = ['productCode'];

export const PACKAGING_HEADER_ALIASES: Record<PackagingField, string[]> = {
  productCode: ['상품코드', '상품 코드', 'SKU', 'SKU코드'],
  productName: ['상품명', '상품 명', '제품명'],
  eaPerBox: ['EA/BOX', 'EA/박스', 'BOX당수량', '박스당수량', 'EA per BOX'],
  eaPerPallet: ['EA/PLT', 'EA/PALLET', 'EA/파렛트', '파렛트당수량', 'PLT당수량'],
  barcode: ['상품바코드', '바코드', 'Barcode', 'BARCODE'],
};

/** 한 행 = 한 상품코드. 비어 있는 셀은 null로 두며(그 필드는 갱신하지 않음), 값이 있는 셀만 반영한다. */
export interface ParsedPackagingRow {
  rowNumber: number;
  productCode: string;
  productName: string | null;
  eaPerBox: number | null;
  eaPerPallet: number | null;
  barcode: string | null;
}

export interface PackagingParseResult {
  rows: ParsedPackagingRow[];
  issues: ValidationIssue[];
}
