import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type {
  AccelerationTrend,
  CoverageAssessment,
  CoverageBand,
  DailyDelta,
  DataMaturity,
  DepletionAcceleration,
  InventoryValueBreakdown,
  OverstockCandidateInfo,
  PeriodComparison,
  RiskThresholdSettings,
  SkuAnalysis,
  StagnationInfo,
  StockObservation,
  StockoutForecast,
  ThresholdRisk,
  WindowDepletion,
} from './types';
import { DEFAULT_RISK_SETTINGS } from './types';

/**
 * 이 모듈은 "재고 Snapshot"만으로 계산 가능한 지표만 다룬다.
 * Snapshot은 판매 데이터가 아니므로 감소량은 "추정 소진량", 증가는 "재고 증가"로만 표현하고
 * 어떤 함수도 실제 판매량을 의미하는 값을 만들어내지 않는다.
 */

function toDate(dateStr: string): Date {
  return parseISO(dateStr);
}

export function sortObservations(observations: StockObservation[]): StockObservation[] {
  return [...observations].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function dailyChange(current: StockObservation, previous: StockObservation): number {
  return current.availableStock - previous.availableStock;
}

export function dailyDepletion(current: StockObservation, previous: StockObservation): number {
  return Math.max(previous.availableStock - current.availableStock, 0);
}

export function dailyIncrease(current: StockObservation, previous: StockObservation): number {
  return Math.max(current.availableStock - previous.availableStock, 0);
}

/** 정렬된 관측값들로부터 인접 스냅샷 간 delta 목록을 만든다 */
export function buildDailyDeltas(sortedObservations: StockObservation[]): DailyDelta[] {
  const deltas: DailyDelta[] = [];
  for (let i = 1; i < sortedObservations.length; i++) {
    const prev = sortedObservations[i - 1];
    const curr = sortedObservations[i];
    const intervalDays = differenceInCalendarDays(toDate(curr.date), toDate(prev.date));
    if (intervalDays <= 0) continue; // 동일 날짜 중복 등 방어
    deltas.push({
      fromDate: prev.date,
      toDate: curr.date,
      intervalDays,
      change: dailyChange(curr, prev),
      depletion: dailyDepletion(curr, prev),
      increase: dailyIncrease(curr, prev),
    });
  }
  return deltas;
}

/** 두 선택일 사이의 변화를 계산한다. 선택일에 스냅샷이 없으면 해당 날짜 이전의 가장 가까운 관측치를 사용한다. */
export function calculatePeriodComparison(
  observations: StockObservation[],
  startDate: string,
  endDate: string,
): PeriodComparison | null {
  const sorted = sortObservations(observations).filter((observation) => observation.date <= endDate);
  const start = [...sorted].reverse().find((observation) => observation.date <= startDate);
  const end = sorted.at(-1);
  if (!start || !end || end.date < start.date) return null;

  const deltas = buildDailyDeltas(sorted).filter((delta) => delta.toDate > start.date && delta.toDate <= end.date);
  const observedDays = deltas.reduce((sum, delta) => sum + delta.intervalDays, 0);
  const totalDepletion = deltas.reduce((sum, delta) => sum + delta.depletion, 0);
  const totalIncrease = deltas.reduce((sum, delta) => sum + delta.increase, 0);

  return {
    requestedStartDate: startDate,
    requestedEndDate: endDate,
    actualStartDate: start.date,
    actualEndDate: end.date,
    startAvailableStock: start.availableStock,
    endAvailableStock: end.availableStock,
    netChange: end.availableStock - start.availableStock,
    totalDepletion,
    totalIncrease,
    observedDays,
    averageDailyDepletion: observedDays > 0 ? totalDepletion / observedDays : null,
  };
}

/**
 * asOfDate 기준 최근 windowDays 안에 "끝나는" delta들만 모아 평균 소진량을 구한다.
 * 분모는 windowDays 고정이 아니라 실제 관측된 interval 합계(observedIntervalDays)다 —
 * 스냅샷이 매일 올라오지 않는 상황을 그대로 반영하기 위함.
 */
export function calculateWindowDepletion(
  deltas: DailyDelta[],
  asOfDate: string,
  windowDays: number,
): WindowDepletion {
  const windowStart = addDays(toDate(asOfDate), -windowDays);
  const relevant = deltas.filter((d) => {
    const toD = toDate(d.toDate);
    return toD > windowStart && toD <= toDate(asOfDate);
  });
  const totalDepletion = relevant.reduce((sum, d) => sum + d.depletion, 0);
  const observedIntervalDays = relevant.reduce((sum, d) => sum + d.intervalDays, 0);
  return {
    windowDays,
    totalDepletion,
    observedIntervalDays,
    averageDailyDepletion: observedIntervalDays > 0 ? totalDepletion / observedIntervalDays : null,
  };
}

export function calculateDataMaturity(sortedObservations: StockObservation[], asOfDate: string): DataMaturity {
  if (sortedObservations.length === 0) {
    return {
      firstObservedDate: null,
      lastObservedDate: null,
      snapshotCount: 0,
      daysSinceFirstObservation: 0,
      hasDayOverDayData: false,
      hasSevenDayData: false,
      hasFourteenDayData: false,
      hasThirtyDayData: false,
    };
  }
  const first = sortedObservations[0].date;
  const last = sortedObservations[sortedObservations.length - 1].date;
  const daysSinceFirstObservation = differenceInCalendarDays(toDate(asOfDate), toDate(first));
  return {
    firstObservedDate: first,
    lastObservedDate: last,
    snapshotCount: sortedObservations.length,
    daysSinceFirstObservation,
    hasDayOverDayData: sortedObservations.length >= 2,
    hasSevenDayData: sortedObservations.length >= 2 && daysSinceFirstObservation >= 7,
    hasFourteenDayData: sortedObservations.length >= 2 && daysSinceFirstObservation >= 14,
    hasThirtyDayData: sortedObservations.length >= 2 && daysSinceFirstObservation >= 30,
  };
}

/** Coverage = 현재 가용재고 / 최근 일평균 추정 소진량. 소진량이 없으면 "무한대" 대신 null. */
export function calculateCoverage(
  currentAvailableStock: number,
  averageDailyDepletion: number | null,
  settings: RiskThresholdSettings = DEFAULT_RISK_SETTINGS,
): CoverageAssessment {
  if (averageDailyDepletion === null || averageDailyDepletion <= 0) {
    return { coverageDays: null, band: null };
  }
  const coverageDays = currentAvailableStock / averageDailyDepletion;
  let band: CoverageBand;
  if (coverageDays <= settings.stockoutSoonDays) band = 'STOCKOUT_SOON';
  else if (coverageDays <= settings.manageMaxDays) band = 'NEEDS_MANAGEMENT';
  else band = 'HEALTHY';
  return { coverageDays, band };
}

/**
 * 예상 소진일. 최소 7일 데이터가 없으면 계산하지 않는다("데이터 축적 중").
 * 최근 데이터에 더 의미를 두어 7일 평균을 기본 근거로 쓰되, 데이터가 아직 14/30일에 못 미치면
 * 확보 가능한 가장 긴 window로 대체한다. 확정 예측이 아니라 "현재 추세 기준 예상"임을 UI가 명시해야 한다.
 */
export function calculateStockoutForecast(
  currentAvailableStock: number,
  asOfDate: string,
  maturity: DataMaturity,
  window7: WindowDepletion,
  window14: WindowDepletion,
  window30: WindowDepletion,
): StockoutForecast {
  if (!maturity.hasSevenDayData) {
    return { expectedStockoutDays: null, expectedStockoutDate: null, confidence: null, basisWindowDays: 7 };
  }

  const basis = window7.averageDailyDepletion !== null ? window7 : window14.averageDailyDepletion !== null ? window14 : window30;
  const basisWindowDays = (basis.windowDays as 7 | 14 | 30) ?? 7;

  if (basis.averageDailyDepletion === null || basis.averageDailyDepletion <= 0) {
    return { expectedStockoutDays: null, expectedStockoutDate: null, confidence: null, basisWindowDays };
  }

  const expectedStockoutDays = currentAvailableStock / basis.averageDailyDepletion;
  const expectedStockoutDate = format(addDays(toDate(asOfDate), Math.round(expectedStockoutDays)), 'yyyy-MM-dd');

  const confidence = calculateConfidence(maturity, window7, window14);

  return { expectedStockoutDays, expectedStockoutDate, confidence, basisWindowDays };
}

/**
 * 단순 설명 가능한 신뢰도 휴리스틱(블랙박스 모델 아님):
 * - 데이터 기간이 길수록 신뢰도 ↑
 * - 최근 7일과 14일 평균 소진 변동성이 크면(변화율 큼) 신뢰도 ↓
 */
export function calculateConfidence(
  maturity: DataMaturity,
  window7: WindowDepletion,
  window14: WindowDepletion,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  let base: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (maturity.hasThirtyDayData) base = 'HIGH';
  else if (maturity.hasFourteenDayData) base = 'MEDIUM';
  else base = 'LOW';

  const r7 = window7.averageDailyDepletion;
  const r14 = window14.averageDailyDepletion;
  if (r7 !== null && r14 !== null && r14 > 0) {
    const volatility = Math.abs(r7 / r14 - 1);
    if (volatility >= 0.6 && base === 'HIGH') base = 'MEDIUM';
    else if (volatility >= 0.6 && base === 'MEDIUM') base = 'LOW';
  }
  return base;
}

/** 소진 가속/둔화: 최소 14일 데이터 필요 */
export function calculateAcceleration(maturity: DataMaturity, deltas: DailyDelta[], asOfDate: string): DepletionAcceleration {
  if (!maturity.hasFourteenDayData) {
    return { recent7AvgDepletion: null, previous7AvgDepletion: null, accelerationRatePercent: null, trend: null };
  }
  const recent7 = calculateWindowDepletion(deltas, asOfDate, 7);
  const eightDaysAgo = format(addDays(toDate(asOfDate), -7), 'yyyy-MM-dd');
  const previous7 = calculateWindowDepletion(deltas, eightDaysAgo, 7);

  const recentAvg = recent7.averageDailyDepletion;
  const prevAvg = previous7.averageDailyDepletion;

  let trend: AccelerationTrend = 'STABLE';
  let rate: number | null = null;

  if (recentAvg === null || prevAvg === null) {
    trend = null;
  } else if (prevAvg === 0) {
    trend = recentAvg > 0 ? 'NEW_DEPLETION' : 'STABLE';
  } else {
    rate = (recentAvg / prevAvg - 1) * 100;
    if (rate >= 20) trend = 'ACCELERATING';
    else if (rate <= -20) trend = 'DECELERATING';
    else trend = 'STABLE';
  }

  return { recent7AvgDepletion: recentAvg, previous7AvgDepletion: prevAvg, accelerationRatePercent: rate, trend };
}

/** Excel의 위험수량/경고수량을 우선 적용하는 기본 위험 판정 */
export function calculateThresholdRisk(observation: StockObservation): ThresholdRisk {
  if (observation.dangerQty > 0 && observation.availableStock <= observation.dangerQty) {
    return { level: 'DANGER', reason: '위험수량 이하' };
  }
  if (observation.warningQty > 0 && observation.availableStock <= observation.warningQty) {
    return { level: 'WARNING', reason: '경고수량 이하' };
  }
  return { level: 'NORMAL', reason: null };
}

/** 장기 정체: 마지막 소진(daily_depletion > 0) 이후 경과일. 30일 데이터 쌓이기 전엔 의미 없음 */
export function calculateStagnation(
  sortedObservations: StockObservation[],
  deltas: DailyDelta[],
  asOfDate: string,
  maturity: DataMaturity,
): StagnationInfo {
  if (sortedObservations.length === 0) {
    return { lastDepletionDate: null, stagnantDays: 0, isMeaningful: false };
  }
  let lastDepletionDate: string | null = null;
  for (let i = deltas.length - 1; i >= 0; i--) {
    if (deltas[i].depletion > 0) {
      lastDepletionDate = deltas[i].toDate;
      break;
    }
  }
  const anchorDate = lastDepletionDate ?? sortedObservations[0].date;
  const stagnantDays = differenceInCalendarDays(toDate(asOfDate), toDate(anchorDate));
  return { lastDepletionDate, stagnantDays, isMeaningful: maturity.hasThirtyDayData };
}

/** 과잉재고 후보: 30일 데이터 필요, 30일 평균 소진 기준 coverage가 임계값 이상이면 "후보"로만 표시 */
export function calculateOverstockCandidate(
  currentAvailableStock: number,
  window30: WindowDepletion,
  maturity: DataMaturity,
  settings: RiskThresholdSettings = DEFAULT_RISK_SETTINGS,
): OverstockCandidateInfo {
  if (!maturity.hasThirtyDayData || window30.averageDailyDepletion === null || window30.averageDailyDepletion <= 0) {
    return { isCandidate: false, coverageDays: null, thresholdDays: settings.overstockCoverageDays };
  }
  const coverageDays = currentAvailableStock / window30.averageDailyDepletion;
  return {
    isCandidate: coverageDays >= settings.overstockCoverageDays,
    coverageDays,
    thresholdDays: settings.overstockCoverageDays,
  };
}

const RISK_RANK = { NORMAL: 0, WARNING: 1, DANGER: 2 } as const;

function coverageBandLabel(band: CoverageBand): string | null {
  if (band === 'STOCKOUT_SOON') return '품절 임박';
  if (band === 'NEEDS_MANAGEMENT') return '관리 필요';
  return null;
}

/** 한 SKU의 전체 분석 결과를 조립한다. 서버 레이어에서 관측 시계열을 조회해 이 함수에 넘긴다. */
export function analyzeSku(
  observations: StockObservation[],
  asOfDate: string,
  settings: RiskThresholdSettings = DEFAULT_RISK_SETTINGS,
): SkuAnalysis | null {
  const sorted = sortObservations(observations.filter((o) => o.date <= asOfDate));
  if (sorted.length === 0) return null;

  const latest = sorted[sorted.length - 1];
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const deltas = buildDailyDeltas(sorted);
  const maturity = calculateDataMaturity(sorted, asOfDate);

  const window7 = calculateWindowDepletion(deltas, asOfDate, 7);
  const window14 = calculateWindowDepletion(deltas, asOfDate, 14);
  const window30 = calculateWindowDepletion(deltas, asOfDate, 30);

  const coverage = maturity.hasSevenDayData
    ? calculateCoverage(latest.availableStock, window7.averageDailyDepletion, settings)
    : { coverageDays: null, band: null };
  const forecast = calculateStockoutForecast(latest.availableStock, asOfDate, maturity, window7, window14, window30);
  const acceleration = calculateAcceleration(maturity, deltas, asOfDate);
  const thresholdRisk = calculateThresholdRisk(latest);
  const stagnation = calculateStagnation(sorted, deltas, asOfDate, maturity);
  const overstock = calculateOverstockCandidate(latest.availableStock, window30, maturity, settings);

  const dailyChangeValue = previous ? dailyChange(latest, previous) : null;
  const stockIncreasedToday = dailyChangeValue !== null && dailyChangeValue > 0;

  const tags: string[] = [];
  if (thresholdRisk.reason) tags.push(`[${thresholdRisk.reason}]`);
  if (coverage.band) {
    const label = coverageBandLabel(coverage.band);
    if (label && coverage.coverageDays !== null) tags.push(`[${label} · ${Math.floor(coverage.coverageDays)}일분]`);
  }
  if (acceleration.trend === 'ACCELERATING' && acceleration.accelerationRatePercent !== null) {
    tags.push(`[소진속도 +${Math.round(acceleration.accelerationRatePercent)}%]`);
  } else if (acceleration.trend === 'DECELERATING' && acceleration.accelerationRatePercent !== null) {
    tags.push(`[소진속도 ${Math.round(acceleration.accelerationRatePercent)}%]`);
  } else if (acceleration.trend === 'NEW_DEPLETION') {
    tags.push('[신규 소진 발생]');
  }
  if (stagnation.isMeaningful && stagnation.stagnantDays >= settings.stagnantDays) {
    tags.push(`[재고 정체 ${stagnation.stagnantDays}일]`);
  }
  if (overstock.isCandidate) tags.push('[과잉재고 후보]');
  if (stockIncreasedToday) tags.push('[재고 증가 감지]');
  const previousThresholdRisk = previous ? calculateThresholdRisk(previous) : null;
  const newlyAtRisk = previousThresholdRisk !== null && RISK_RANK[thresholdRisk.level] > RISK_RANK[previousThresholdRisk.level];
  if (newlyAtRisk) tags.push('[신규 위험]');

  return {
    asOfDate,
    latest,
    previous,
    dailyChange: dailyChangeValue,
    maturity,
    window7,
    window14,
    window30,
    coverage,
    forecast,
    acceleration,
    thresholdRisk,
    stagnation,
    overstock,
    tags,
    stockIncreasedToday,
  };
}

/** 오늘 새롭게 위험/주의 단계로 악화된 SKU인지("어제 정상 → 오늘 주의/위험" 등). tags에도 '[신규 위험]'으로 반영됨 */
export function isNewlyAtRisk(analysis: SkuAnalysis): boolean {
  if (!analysis.previous) return false;
  const prevRisk = calculateThresholdRisk(analysis.previous).level;
  return RISK_RANK[analysis.thresholdRisk.level] > RISK_RANK[prevRisk];
}

/** 재고자산 계산. 정상재고 × 단위원가만 기본 자산으로 인정하고, 나머지는 별도 항목으로만 제공(이중계산 금지) */
export function calculateInventoryValue(observation: Pick<StockObservation, 'normalStock' | 'unitCost'>): number {
  return observation.normalStock * observation.unitCost;
}

export function calculateInventoryValueBreakdown(
  observation: Pick<StockObservation, 'normalStock' | 'availableStock' | 'defectiveStock' | 'incomingStock' | 'unitCost'>,
): InventoryValueBreakdown {
  return {
    normalStockValue: observation.normalStock * observation.unitCost,
    availableStockValue: observation.availableStock * observation.unitCost,
    defectiveStockValue: observation.defectiveStock * observation.unitCost,
    incomingStockValue: observation.incomingStock * observation.unitCost,
  };
}
