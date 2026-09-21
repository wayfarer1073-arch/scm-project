import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePackagingWorkbook } from './packaging-parser';

function buildXlsxBuffer(aoa: (string | number)[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return out as Buffer;
}

const HEADER = ['상품코드', '상품명', 'EA/BOX', 'EA/PLT', '상품바코드'];

describe('parsePackagingWorkbook', () => {
  it('상품코드/상품명/EA-BOX/EA-PLT/바코드를 정상 파싱한다', () => {
    const rows = [HEADER, ['00001', '상품 A', '24', '480', '8801234567890']];
    const result = parsePackagingWorkbook(buildXlsxBuffer(rows));
    expect(result.issues.filter((i) => i.level === 'ERROR')).toHaveLength(0);
    expect(result.rows).toEqual([{ rowNumber: 1, productCode: '00001', productName: '상품 A', eaPerBox: 24, eaPerPallet: 480, barcode: '8801234567890' }]);
  });

  it('상품코드만 있으면 되고, 나머지 컬럼이 비어 있으면 null로 둔다(기존 값 유지 목적)', () => {
    const rows = [HEADER, ['00001', '', '', '', '']];
    const result = parsePackagingWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toEqual([{ rowNumber: 1, productCode: '00001', productName: null, eaPerBox: null, eaPerPallet: null, barcode: null }]);
  });

  it('상품코드가 없는 행은 WARNING으로 건너뛰고 나머지는 반영한다', () => {
    const rows = [HEADER, ['', '상품 A', '24', '480', ''], ['00002', '상품 B', '12', '240', '']];
    const result = parsePackagingWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].productCode).toBe('00002');
    expect(result.issues.some((i) => i.code === 'MISSING_PRODUCT_CODE')).toBe(true);
  });

  it('EA/BOX·EA/PLT가 숫자가 아니면 그 필드만 WARNING과 함께 null로 두고 행은 유지한다', () => {
    const rows = [HEADER, ['00001', '상품 A', '스물넷', '-5', '8801234567890']];
    const result = parsePackagingWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toEqual([{ rowNumber: 1, productCode: '00001', productName: '상품 A', eaPerBox: null, eaPerPallet: null, barcode: '8801234567890' }]);
    expect(result.issues.some((i) => i.code === 'INVALID_EA_PER_BOX')).toBe(true);
    expect(result.issues.some((i) => i.code === 'INVALID_EA_PER_PALLET')).toBe(true);
  });

  it('필수 컬럼(상품코드)이 없으면 ERROR를 반환하고 저장하지 않는다', () => {
    const rows = [['상품명', 'EA/BOX'], ['상품A', '24']];
    const result = parsePackagingWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_COLUMN' && i.level === 'ERROR')).toBe(true);
  });

  it('빈 파일은 ERROR를 반환한다', () => {
    const result = parsePackagingWorkbook(buildXlsxBuffer([]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'EMPTY_FILE')).toBe(true);
  });
});
