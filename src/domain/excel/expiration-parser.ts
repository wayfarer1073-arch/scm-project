import type { ValidationIssue } from './types';
import { bufferToAoa, normalizeString, findHeaderRowIndex, buildHeaderMap } from './aoa-reader';
import {
  EXPIRATION_FIELDS,
  EXPIRATION_HEADER_ALIASES,
  EXPIRATION_REQUIRED_FIELDS,
  type ExpirationField,
  type ExpirationParseResult,
  type ParsedExpirationRow,
} from './expiration-types';

const MAX_DATA_ROWS = 50_000;

/** "2027-01-01" / "2027.01.01" / "2027/01/01" 등을 모두 허용하고 'yyyy-MM-dd'로 정규화한다. */
function parseFlexibleDate(value: string): string | null {
  const trimmed = normalizeString(value);
  if (trimmed === '') return null;
  const match = trimmed.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const iso = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  // new Date()는 "2027-02-30" 같은 존재하지 않는 날짜를 자동 보정하므로, 되돌린 문자열이
  // 입력과 일치하는지 검사해 실제 달력 날짜인지 확인한다.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/**
 * 유통기한/소비기한 관리용 Excel을 파싱한다. 재고 스냅샷 파서와 달리 행 단위 오류(상품코드 누락,
 * 날짜 해석 실패)는 WARNING으로 처리하고 나머지 유효한 행은 그대로 반영한다 — 대량 로트별 내보내기에서
 * 일부 행 품질 문제로 전체 업로드가 막히면 오히려 운영에 방해가 된다. 구조적 문제(필수 컬럼 없음,
 * 데이터 없음)만 ERROR로 막는다.
 */
export function parseExpirationWorkbook(buffer: Buffer): ExpirationParseResult {
  const issues: ValidationIssue[] = [];
  const aoa = bufferToAoa(buffer);

  if (aoa.length === 0) {
    issues.push({ level: 'ERROR', code: 'EMPTY_FILE', message: '파일에서 표 데이터를 찾을 수 없습니다.' });
    return { rows: [], issues };
  }

  const headerRowIdx = findHeaderRowIndex(aoa, EXPIRATION_HEADER_ALIASES, 2);
  const headerRow = aoa[headerRowIdx];
  const headerMap = buildHeaderMap(headerRow, EXPIRATION_HEADER_ALIASES, EXPIRATION_FIELDS);

  const missingRequired = EXPIRATION_REQUIRED_FIELDS.filter((f) => !headerMap[f]);
  if (missingRequired.length > 0) {
    for (const field of missingRequired) {
      issues.push({
        level: 'ERROR',
        code: 'MISSING_REQUIRED_COLUMN',
        message: `필수 컬럼을 찾을 수 없습니다: ${EXPIRATION_HEADER_ALIASES[field][0]} (인식 가능한 이름: ${EXPIRATION_HEADER_ALIASES[field].join(', ')})`,
        column: field,
      });
    }
    return { rows: [], issues };
  }

  const headerIndexByField = new Map<ExpirationField, number>();
  for (const field of EXPIRATION_FIELDS) {
    const headerName = headerMap[field];
    if (!headerName) continue;
    headerIndexByField.set(field, headerRow.indexOf(headerName));
  }

  const dataRows = aoa.slice(headerRowIdx + 1).filter((r) => r.some((c) => normalizeString(c) !== ''));
  if (dataRows.length === 0) {
    issues.push({ level: 'ERROR', code: 'NO_DATA_ROWS', message: '헤더는 있지만 데이터가 한 건도 없습니다.' });
    return { rows: [], issues };
  }
  if (dataRows.length > MAX_DATA_ROWS) {
    issues.push({
      level: 'ERROR',
      code: 'TOO_MANY_ROWS',
      message: `행이 ${dataRows.length.toLocaleString()}건으로 처리 가능한 최대치(${MAX_DATA_ROWS.toLocaleString()}건)를 초과합니다.`,
    });
    return { rows: [], issues };
  }

  // productCode -> 가장 이른(soonest) 소비기한. 같은 상품이 로트별로 여러 행에 걸쳐 있으면
  // 가장 급하게 관리해야 할 날짜를 대표값으로 삼는다.
  const soonestByCode = new Map<string, { rowNumber: number; productName: string | null; expirationDate: string }>();

  dataRows.forEach((rawRow, i) => {
    const rowNumber = i + 1;
    const get = (field: ExpirationField): string => {
      const idx = headerIndexByField.get(field);
      if (idx === undefined || idx === -1) return '';
      return normalizeString(rawRow[idx]);
    };

    const productCode = get('productCode');
    if (productCode === '') {
      issues.push({ level: 'WARNING', code: 'MISSING_PRODUCT_CODE', message: `${rowNumber}행: 상품코드가 비어 있어 건너뜁니다.`, rowNumber, column: 'productCode' });
      return;
    }
    const rawDate = get('expirationDate');
    const expirationDate = parseFlexibleDate(rawDate);
    if (!expirationDate) {
      issues.push({
        level: 'WARNING',
        code: 'INVALID_EXPIRATION_DATE',
        message: `${rowNumber}행: '${rawDate}'을(를) 날짜로 해석할 수 없어 건너뜁니다.`,
        rowNumber,
        column: 'expirationDate',
      });
      return;
    }

    const productName = get('productName') || null;
    const existing = soonestByCode.get(productCode);
    if (!existing || expirationDate < existing.expirationDate) {
      soonestByCode.set(productCode, { rowNumber, productName, expirationDate });
    }
  });

  const rows: ParsedExpirationRow[] = [...soonestByCode.entries()].map(([productCode, v]) => ({
    rowNumber: v.rowNumber,
    productCode,
    productName: v.productName,
    expirationDate: v.expirationDate,
  }));

  return { rows, issues };
}
