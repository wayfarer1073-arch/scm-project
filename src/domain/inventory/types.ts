/** 재고 도메인 공용 타입. 전부 순수 데이터 — DB/Prisma 타입과 분리해 계산 로직을 테스트하기 쉽게 유지한다. */

/** 특정 SKU의 특정 기준일 스냅샷 관측값 (날짜는 'YYYY-MM-DD', KST 달력 기준) */
export interface StockObservation {
  date: string;
  availableStock: number;
  normalStock: number;
  defectiveStock: number;
  incomingStock: number;
  unitCost: number;
  warningQty: number;
  dangerQty: number;
}

/** 인접한 두 스냅샷 사이의 변화. interval은 두 스냅샷 간 실제 경과일수(업로드 누락 등으로 1일보다 클 수 있음) */
export interface DailyDelta {
  fromDate: string;
  toDate: string;
  intervalDays: number;
  change: number; // current - previous (부호 있음)
  depletion: number; // max(previous - current, 0)
  increase: number; // max(current - previous, 0)
}

/** 특정 window(예: 7/14/30일)에 대한 평균 소진량 계산 결과 */
export interface WindowDepletion {
  windowDays: number;
  /** 총 소진량 합계 */
  totalDepletion: number;
  /** 실제로 관측된 interval의 합계 일수(스냅샷이 매일 올라오지 않을 수 있어 windowDays와 다를 수 있음) */
  observedIntervalDays: number;
  /** totalDepletion / observedIntervalDays. 관측 interval이 없으면 null */
  averageDailyDepletion: number | null;
}

export interface DataMaturity {
  firstObservedDate: string | null;
  lastObservedDate: string | null;
  snapshotCount: number;
  /** firstObservedDate ~ asOfDate 경과일수 */
  daysSinceFirstObservation: number;
  hasDayOverDayData: boolean; // >= 2 snapshots
  hasSevenDayData: boolean; // >= 7 days span
  hasFourteenDayData: boolean; // >= 14 days span
  hasThirtyDayData: boolean; // >= 30 days span
}

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface StockoutForecast {
  /** 데이터 축적 기간 부족(7일 미만)이면 null이고 UI는 "데이터 축적 중" 표시 */
  expectedStockoutDays: number | null;
  expectedStockoutDate: string | null;
  confidence: ConfidenceLevel | null;
  basisWindowDays: 7 | 14 | 30;
}

export type AccelerationTrend = 'ACCELERATING' | 'DECELERATING' | 'STABLE' | 'NEW_DEPLETION' | null;

export interface DepletionAcceleration {
  recent7AvgDepletion: number | null;
  previous7AvgDepletion: number | null;
  /** (recent7/previous7 - 1) * 100. previous7이 0이면 null이고 trend로 별도 표기 */
  accelerationRatePercent: number | null;
  trend: AccelerationTrend;
}

export type RiskLevel = 'DANGER' | 'WARNING' | 'NORMAL';

/** Excel의 위험수량/경고수량 기준 (우선 적용 규칙) */
export interface ThresholdRisk {
  level: RiskLevel;
  reason: '위험수량 이하' | '경고수량 이하' | null;
}

export type CoverageBand = 'STOCKOUT_SOON' | 'NEEDS_MANAGEMENT' | 'HEALTHY' | null;

export interface CoverageAssessment {
  /** 소진량이 0이면 null이며 UI는 "소진 없음" 또는 "-" 표시 */
  coverageDays: number | null;
  band: CoverageBand;
}

export interface StagnationInfo {
  /** 마지막으로 daily_depletion > 0이 관측된 날짜. 한 번도 감소가 없었다면 firstObservedDate */
  lastDepletionDate: string | null;
  stagnantDays: number;
  /** 30일 이상 데이터가 쌓이기 전에는 의미 없는 값이므로 null */
  isMeaningful: boolean;
}

export interface OverstockCandidateInfo {
  isCandidate: boolean;
  /** 판단에 사용한 coverage (30일 평균 소진 기준) */
  coverageDays: number | null;
  thresholdDays: number;
}

export interface RiskThresholdSettings {
  stockoutSoonDays: number;
  manageMaxDays: number;
  overstockCoverageDays: number;
  stagnantDays: number;
}

export const DEFAULT_RISK_SETTINGS: RiskThresholdSettings = {
  stockoutSoonDays: 7,
  manageMaxDays: 30,
  overstockCoverageDays: 90,
  stagnantDays: 30,
};

export interface InventoryValueBreakdown {
  normalStockValue: number; // 기본 재고자산 (정상재고 × 원가)
  availableStockValue: number; // 참고용
  defectiveStockValue: number;
  incomingStockValue: number;
}

export interface CompanyKpis {
  totalSkuCount: number;
  totalAvailableStock: number;
  totalInventoryValue: number;
  netChangeVsYesterday: number | null;
  totalDepletion7d: number;
  /** 기간 비교 모드에서 SKU별 실제 관측 기간에 맞춰 계산한 일평균 감소량의 평균 (SKU마다 관측 기간이
   * 다를 수 있어 전체 합계를 단일 기간일수로 나누지 않는다). 비교 가능한 SKU가 없으면 null. */
  averageDailyDecreasePerSku?: number | null;
  dangerSkuCount: number;
  stockoutSoon30dCount: number;
  stagnantValue: number;
  totalDecrease?: number;
  totalIncrease?: number;
  forecastReadyCount?: number;
  overstockCandidateValue?: number;
}

export interface PeriodComparison {
  requestedStartDate: string;
  requestedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  startAvailableStock: number;
  endAvailableStock: number;
  netChange: number;
  totalDepletion: number;
  totalIncrease: number;
  observedDays: number;
  averageDailyDepletion: number | null;
}

export interface WarehouseSummary {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  skuCount: number;
  inventoryValue: number;
  dangerSkuCount: number;
  dangerRatio: number;
  stockoutSoon30dRatio: number;
  stagnantRatio: number;
  overstockCandidateRatio: number;
}

/** SKU 한 건에 대한 계산된 전체 분석 결과 (테이블/상세/Action Center가 공유) */
export interface SkuAnalysis {
  asOfDate: string;
  latest: StockObservation;
  previous: StockObservation | null;
  dailyChange: number | null;
  maturity: DataMaturity;
  window7: WindowDepletion;
  window14: WindowDepletion;
  window30: WindowDepletion;
  coverage: CoverageAssessment;
  forecast: StockoutForecast;
  acceleration: DepletionAcceleration;
  thresholdRisk: ThresholdRisk;
  stagnation: StagnationInfo;
  overstock: OverstockCandidateInfo;
  /** 화면에 그대로 표시할 수 있는 근거 태그 목록 (예: "[위험수량 이하]", "[12일분 남음]") */
  tags: string[];
  stockIncreasedToday: boolean;
}
