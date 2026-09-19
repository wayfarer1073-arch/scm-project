import type { SkuAnalysis, InventoryValueBreakdown, PeriodComparison } from './types';

export interface SkuDescriptor {
  skuId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  option: string | null;
  barcode: string | null;
  location: string | null;
  /** 관리자가 SKU 상세에서 직접 지정한 위험/경고수량. null이면 자동계산을 쓴다. */
  manualDangerQty: number | null;
  manualWarningQty: number | null;
  expirationDate: string | null;
  /** 소비기한 위험 판정 일수. null이면 앱의 기본값(DEFAULT_EXPIRATION_RISK_DAYS)을 쓴다. */
  expirationRiskDays: number | null;
  /** 관리자가 직접 지정하는 B2B 상품 마커. */
  isB2B: boolean;
  /** 이 SKU가 이 창고에서 처음 관측된 날짜(최초 업로드로 인식된 시점). */
  firstSeenDate: string;
}

export interface DailyWarehouseTotal {
  date: string;
  warehouseId: string;
  totalAvailableStock: number;
  totalInventoryValue: number;
}

export interface InventoryRow {
  descriptor: SkuDescriptor;
  analysis: SkuAnalysis;
  valueBreakdown: InventoryValueBreakdown;
  periodComparison: PeriodComparison | null;
}
