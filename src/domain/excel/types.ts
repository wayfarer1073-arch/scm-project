/** Excel 임포트 도메인 타입. 시트 헤더명을 내부 필드로 매핑해 컬럼 순서 변화에 영향받지 않게 한다. */

export const CANONICAL_FIELDS = [
  'productCode',
  'productName',
  'option',
  'barcode',
  'unitCost',
  'normalStock',
  'availableStock',
  'incomingStock',
  'defectiveStock',
  'warningQty',
  'dangerQty',
  'location',
  'category',
  'supplierName',
  'salePrice',
  'supplyPrice',
  'marketPrice',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** 헤더 검증에 반드시 필요한 컬럼(없으면 파일 전체를 저장하지 않는다) */
export const REQUIRED_FIELDS: CanonicalField[] = [
  'productCode',
  'productName',
  'unitCost',
  'normalStock',
  'availableStock',
  'incomingStock',
  'defectiveStock',
  'warningQty',
  'dangerQty',
];

export const NUMERIC_FIELDS: CanonicalField[] = [
  'unitCost',
  'normalStock',
  'availableStock',
  'incomingStock',
  'defectiveStock',
  'warningQty',
  'dangerQty',
  'salePrice',
  'supplyPrice',
  'marketPrice',
];

/** 실제 샘플 파일 헤더명을 기준으로 한 매핑. 컬럼명이 약간 달라도 인식할 수 있게 후보를 여러 개 둔다. */
export const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  productCode: ['상품코드', '상품 코드', 'SKU', 'SKU코드'],
  productName: ['상품명', '상품 명', '제품명'],
  option: ['옵션', '옵션명'],
  barcode: ['바코드'],
  unitCost: ['원가', '단가', '단위원가'],
  normalStock: ['정상재고'],
  availableStock: ['가용재고'],
  incomingStock: ['입고대기'],
  defectiveStock: ['불량재고'],
  warningQty: ['경고수량'],
  dangerQty: ['위험수량'],
  location: ['로케이션', '로케이션이력', '위치'],
  category: ['카테고리', '분류'],
  supplierName: ['공급처'],
  salePrice: ['판매가'],
  supplyPrice: ['공급가'],
  marketPrice: ['시중가'],
};

export interface ParsedInventoryRow {
  rowNumber: number; // 원본 시트 상 행 번호(헤더 제외, 1부터) - 오류 메시지용
  productCode: string;
  productName: string;
  option: string | null;
  barcode: string | null;
  unitCost: number;
  normalStock: number;
  availableStock: number;
  incomingStock: number;
  defectiveStock: number;
  warningQty: number;
  dangerQty: number;
  location: string | null;
  category: string | null;
  /** 원본 부가 필드 전체 (export/보존용) */
  extra: Record<string, string>;
  costMissing: boolean;
}

export type IssueLevel = 'ERROR' | 'WARNING';

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  rowNumber?: number;
  column?: string;
}

export interface ParseResult {
  rows: ParsedInventoryRow[];
  headerMap: Partial<Record<CanonicalField, string>>;
  issues: ValidationIssue[];
}
