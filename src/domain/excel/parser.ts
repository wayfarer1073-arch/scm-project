import * as XLSX from 'xlsx';
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

/**
 * 사내 재고 Excel 익스포트 중 상당수가 실제로는 "HTML table을 .xls 확장자로 저장한" 파일이다
 * (사방넷류 ERP의 표준 익스포트 방식). SheetJS가 이를 못 읽는 경우를 대비해 직접 HTML 테이블 파서를
 * fallback으로 둔다.
 */
function looksLikeHtmlTable(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 2048).toString('utf-8').toLowerCase();
  return head.includes('<html') || head.includes('<table');
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function parseHtmlTableToAoa(text: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = text.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const rowHtml of rowMatches) {
    const cellMatches = rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
    if (cellMatches.length === 0) continue;
    const cells = cellMatches.map((cellHtml) => {
      const inner = cellHtml.replace(/^<t[dh][^>]*>/i, '').replace(/<\/t[dh]>$/i, '');
      return stripHtmlTags(inner);
    });
    rows.push(cells);
  }
  return rows;
}

function bufferToAoa(buffer: Buffer): string[][] {
  if (looksLikeHtmlTable(buffer)) {
    const text = buffer.toString('utf-8');
    const aoa = parseHtmlTableToAoa(text);
    if (aoa.length > 0) return aoa;
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellText: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
  return aoa.map((row) => row.map((cell) => (cell ?? '').toString()));
}

function normalizeHeaderCell(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function normalizeString(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  return value.replace(/ /g, ' ').trim().replace(/\s+/g, ' ');
}

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

function buildHeaderMap(headerRow: string[]): Partial<Record<CanonicalField, string>> {
  const normalizedHeaders = headerRow.map(normalizeHeaderCell);
  const map: Partial<Record<CanonicalField, string>> = {};
  for (const field of CANONICAL_FIELDS) {
    const aliases = HEADER_ALIASES[field].map(normalizeHeaderCell);
    const idx = normalizedHeaders.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[field] = headerRow[idx];
  }
  return map;
}

function findHeaderRowIndex(aoa: string[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const normalized = aoa[i].map(normalizeHeaderCell);
    const hits = CANONICAL_FIELDS.filter((f) => HEADER_ALIASES[f].some((alias) => normalized.includes(normalizeHeaderCell(alias))));
    if (hits.length >= 3) return i;
  }
  return 0;
}

export function parseInventoryWorkbook(buffer: Buffer): ParseResult {
  const issues: ValidationIssue[] = [];
  const aoa = bufferToAoa(buffer);

  if (aoa.length === 0) {
    issues.push({ level: 'ERROR', code: 'EMPTY_FILE', message: '파일에서 표 데이터를 찾을 수 없습니다.' });
    return { rows: [], headerMap: {}, issues };
  }

  const headerRowIdx = findHeaderRowIndex(aoa);
  const headerRow = aoa[headerRowIdx];
  const headerMap = buildHeaderMap(headerRow);

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
      } else {
        numericValues[field] = parsed;
      }
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
      const isMapped = CANONICAL_FIELDS.some((f) => headerMap[f] === h);
      if (!isMapped && normalizedH !== '') {
        const value = normalizeString(rawRow[idx]);
        if (value !== '') extra[h] = value;
      }
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
