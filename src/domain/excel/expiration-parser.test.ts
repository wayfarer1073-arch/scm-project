import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExpirationWorkbook } from './expiration-parser';

function buildXlsxBuffer(aoa: (string | number)[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return out as Buffer;
}

const HEADER = ['공급처', '상품코드', '상품명', '로트번호', '유통기한', '로케이션', '수량(로케이션)'];

describe('parseExpirationWorkbook', () => {
  it('상품코드/상품명/유통기한을 정상 파싱한다', () => {
    const rows = [HEADER, ['거래처A', '00001', '상품 A', 'L1', '2027-01-01', 'A-01', '10']];
    const result = parseExpirationWorkbook(buildXlsxBuffer(rows));
    expect(result.issues.filter((i) => i.level === 'ERROR')).toHaveLength(0);
    expect(result.rows).toEqual([{ rowNumber: 1, productCode: '00001', productName: '상품 A', expirationDate: '2027-01-01' }]);
  });

  it('같은 상품코드가 여러 로트로 나뉘면 가장 이른 유통기한을 대표값으로 삼는다', () => {
    const rows = [
      HEADER,
      ['거래처A', '00001', '상품 A', 'L1', '2027-06-01', 'A-01', '10'],
      ['거래처A', '00001', '상품 A', 'L2', '2027-01-01', 'A-02', '5'],
      ['거래처A', '00001', '상품 A', 'L3', '2027-12-01', 'A-03', '3'],
    ];
    const result = parseExpirationWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].expirationDate).toBe('2027-01-01');
  });

  it('점(.) 또는 슬래시(/) 구분 날짜도 인식한다', () => {
    const rows = [HEADER, ['거래처A', '00001', '상품 A', '', '2027.03.15', '', '']];
    const result = parseExpirationWorkbook(buildXlsxBuffer(rows));
    expect(result.rows[0].expirationDate).toBe('2027-03-15');
  });

  it('필수 컬럼(상품코드/유통기한)이 없으면 ERROR를 반환하고 저장하지 않는다', () => {
    const rows = [['상품명', '로케이션'], ['상품A', 'A-01']];
    const result = parseExpirationWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_COLUMN' && i.level === 'ERROR')).toBe(true);
  });

  it('상품코드가 없거나 날짜를 해석할 수 없는 행은 WARNING으로 건너뛰고 나머지는 반영한다(회귀 테스트)', () => {
    const rows = [
      HEADER,
      ['거래처A', '', '상품 A', '', '2027-01-01', '', ''],
      ['거래처A', '00002', '상품 B', '', '알수없음', '', ''],
      ['거래처A', '00003', '상품 C', '', '2027-05-05', '', ''],
    ];
    const result = parseExpirationWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].productCode).toBe('00003');
    expect(result.issues.filter((i) => i.level === 'WARNING')).toHaveLength(2);
    expect(result.issues.some((i) => i.code === 'MISSING_PRODUCT_CODE')).toBe(true);
    expect(result.issues.some((i) => i.code === 'INVALID_EXPIRATION_DATE')).toBe(true);
  });

  it('존재하지 않는 달력 날짜(2월 30일)는 건너뛴다', () => {
    const rows = [HEADER, ['거래처A', '00001', '상품 A', '', '2027-02-30', '', '']];
    const result = parseExpirationWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'INVALID_EXPIRATION_DATE')).toBe(true);
  });
});
