import {
  CANONICAL_FIELDS,
  HEADER_ALIASES,
  NUMERIC_FIELDS,
  REQUIRED_FIELDS,
  type CanonicalField,
  type ParseResult,
  type ParsedInventoryRow,
  type ValidationIssue,
} from './types';
import { bufferToAoa, normalizeString, normalizeHeaderCell, findHeaderRowIndex, buildHeaderMap } from './aoa-reader';

/** 콤마 천단위 구분자, 공백, 통화기호를 제거하고 숫자로 변환한다. 빈 값/파싱 실패는 null. */
function normalizeNumber(value: string): number | null {
  const trimmed = normalizeString(value);
  if (trimmed === '') return null;
  const cleaned = trimmed.replace(/,/g, '').replace(/원$/, '').trim();
  if (cleaned === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** DB에 정수(Int) 컬럼으로 저장되는 필드. 소수는 허용하지 않는다. */
const INTEGER_FIELDS: CanonicalField[] = [
  'normalStock',
  'availableStock',
  'incomingStock',
  'defectiveStock',
  'warningQty',
  'dangerQty',
];

// PostgreSQL Int(4바이트)의 표현 범위. 초과 값은 DB insert 시점에 에러가 나므로 파싱 단계에서 먼저 막는다.
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

// unitCost 등 Decimal(14,2) 컬럼의 표현 범위 (정수부 최대 12자리).
const DECIMAL_14_2_MAX = 10 ** 12 - 0.01;
const DECIMAL_14_2_MIN = -DECIMAL_14_2_MAX;

/** canonical 필드로는 인식되지만 ParsedInventoryRow에 전용 컬럼이 없는 필드 (InventoryItem.extra에 보존) */
const FIELDS_WITHOUT_DEDICATED_COLUMN: CanonicalField[] = ['supplierName', 'salePrice', 'supplyPrice', 'marketPrice'];

const MAX_DATA_ROWS = 50_000; // 실제 창고 품목 수보다 훨씬 넉넉한 상한 (동기 파싱 리소스 보호용)

export function parseInventoryWorkbook(buffer: Buffer): ParseResult {
  const issues: ValidationIssue[] = [];
  const aoa = bufferToAoa(buffer);

  if (aoa.length === 0) {
    issues.push({ level: 'ERROR', code: 'EMPTY_FILE', message: '파일에서 표 데이터를 찾을 수 없습니다.' });
    return { rows: [], headerMap: {}, issues };
  }

  const headerRowIdx = findHeaderRowIndex(aoa, HEADER_ALIASES);
  const headerRow = aoa[headerRowIdx];
  const headerMap = buildHeaderMap(headerRow, HEADER_ALIASES, CANONICAL_FIELDS);

  const missingRequired = REQUIRED_FIELDS.filter((f) => !headerMap[f]);
  if (missingRequired.length > 0) {
    for (const field of missingRequired) {
      issues.push({
        level: 'ERROR',
        code: 'MISSING_REQUIRED_COLUMN',
        message: `필수 컬럼을 찾을 수 없습니다: ${HEADER_ALIASES[field][0]} (인식 가능한 이름: ${HEADER_ALIASES[field].join(', ')})`,
        column: field,
      });
    }
    return { rows: [], headerMap, issues };
  }

  const headerIndexByField = new Map<CanonicalField, number>();
  for (const field of CANONICAL_FIELDS) {
    const headerName = headerMap[field];
    if (!headerName) continue;
    headerIndexByField.set(field, headerRow.indexOf(headerName));
  }

  const dataRows = aoa.slice(headerRowIdx + 1).filter((r) => r.some((c) => normalizeString(c) !== ''));

  if (dataRows.length === 0) {
    issues.push({ level: 'ERROR', code: 'NO_DATA_ROWS', message: '헤더는 있지만 상품 데이터가 한 건도 없습니다.' });
    return { rows: [], headerMap, issues };
  }
  if (dataRows.length > MAX_DATA_ROWS) {
    issues.push({
      level: 'ERROR',
      code: 'TOO_MANY_ROWS',
      message: `상품 행이 ${dataRows.length.toLocaleString()}건으로 처리 가능한 최대치(${MAX_DATA_ROWS.toLocaleString()}건)를 초과합니다.`,
    });
    return { rows: [], headerMap, issues };
  }

  const rows: ParsedInventoryRow[] = [];
  const seenProductCodes = new Map<string, number>(); // productCode -> first rowNumber

  dataRows.forEach((rawRow, i) => {
    const rowNumber = i + 1;
    const get = (field: CanonicalField): string => {
      const idx = headerIndexByField.get(field);
      if (idx === undefined || idx === -1) return '';
      return normalizeString(rawRow[idx]);
    };

    const productCode = get('productCode');
    if (productCode === '') {
      issues.push({ level: 'ERROR', code: 'MISSING_PRODUCT_CODE', message: `${rowNumber}행: 상품코드가 비어 있습니다.`, rowNumber, column: 'productCode' });
      return;
    }
    if (seenProductCodes.has(productCode)) {
      issues.push({
        level: 'ERROR',
        code: 'DUPLICATE_PRODUCT_CODE',
        message: `${rowNumber}행: 상품코드 '${productCode}'가 ${seenProductCodes.get(productCode)}행과 중복됩니다.`,
        rowNumber,
        column: 'productCode',
      });
      return;
    }
    seenProductCodes.set(productCode, rowNumber);

    const numericValues: Partial<Record<CanonicalField, number>> = {};
    let hasParseFailure = false;
    for (const field of NUMERIC_FIELDS) {
      const raw = get(field);
      if (raw === '') {
        numericValues[field] = field === 'unitCost' ? 0 : 0;
        continue;
      }
      const parsed = normalizeNumber(raw);
      if (parsed === null) {
        issues.push({
          level: 'ERROR',
          code: 'NUMBER_PARSE_FAILED',
          message: `${rowNumber}행: '${HEADER_ALIASES[field][0]}' 값 '${raw}'을(를) 숫자로 해석할 수 없습니다.`,
          rowNumber,
          column: field,
        });
        hasParseFailure = true;
        continue;
      }
      if (INTEGER_FIELDS.includes(field) && !Number.isInteger(parsed)) {
        issues.push({
          level: 'ERROR',
          code: 'NUMBER_NOT_INTEGER',
          message: `${rowNumber}행: '${HEADER_ALIASES[field][0]}' 값 '${raw}'은(는) 소수가 아닌 정수여야 합니다.`,
          rowNumber,
          column: field,
        });
        hasParseFailure = true;
        continue;
      }
      const [rangeMin, rangeMax] = INTEGER_FIELDS.includes(field) ? [INT32_MIN, INT32_MAX] : [DECIMAL_14_2_MIN, DECIMAL_14_2_MAX];
      if (parsed < rangeMin || parsed > rangeMax) {
        issues.push({
          level: 'ERROR',
          code: 'NUMBER_OUT_OF_RANGE',
          message: `${rowNumber}행: '${HEADER_ALIASES[field][0]}' 값 '${raw}'이(가) 처리 가능한 범위를 벗어났습니다.`,
          rowNumber,
          column: field,
        });
        hasParseFailure = true;
        continue;
      }
      numericValues[field] = parsed;
    }
    if (hasParseFailure) return;

    const costMissing = get('unitCost') === '';
    if (costMissing) {
      issues.push({ level: 'WARNING', code: 'COST_MISSING', message: `${rowNumber}행: 원가가 비어 있습니다.`, rowNumber, column: 'unitCost' });
    }

    if ((numericValues.availableStock ?? 0) < 0 || (numericValues.normalStock ?? 0) < 0) {
      issues.push({
        level: 'WARNING',
        code: 'NEGATIVE_STOCK',
        message: `${rowNumber}행: 재고 수량이 음수입니다 (정상재고=${numericValues.normalStock}, 가용재고=${numericValues.availableStock}).`,
        rowNumber,
      });
    }

    const extra: Record<string, string> = {};
    headerRow.forEach((h, idx) => {
      const normalizedH = normalizeHeaderCell(h);
      if (normalizedH === '') return;
      const mappedField = CANONICAL_FIELDS.find((f) => headerMap[f] === h);
      // supplierName/salePrice/supplyPrice/marketPrice는 canonical 필드로 인식은 되지만
      // ParsedInventoryRow에 전용 컬럼이 없다. 인식됐다는 이유로 버리지 않고 extra에 보존한다.
      const hasDedicatedColumn = mappedField !== undefined && !FIELDS_WITHOUT_DEDICATED_COLUMN.includes(mappedField);
      if (hasDedicatedColumn) return;
      const value = normalizeString(rawRow[idx]);
      if (value !== '') extra[h] = value;
    });

    rows.push({
      rowNumber,
      productCode,
      productName: get('productName'),
      option: get('option') || null,
      barcode: get('barcode') || null,
      unitCost: numericValues.unitCost ?? 0,
      normalStock: numericValues.normalStock ?? 0,
      availableStock: numericValues.availableStock ?? 0,
      incomingStock: numericValues.incomingStock ?? 0,
      defectiveStock: numericValues.defectiveStock ?? 0,
      warningQty: numericValues.warningQty ?? 0,
      dangerQty: numericValues.dangerQty ?? 0,
      location: get('location') || null,
      category: get('category') || null,
      extra,
      costMissing,
    });
  });

  return { rows, headerMap, issues };
}
