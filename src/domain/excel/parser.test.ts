import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseInventoryWorkbook } from './parser';

function buildXlsxBuffer(aoa: (string | number)[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('parseInventoryWorkbook - 최소 헤더 기반 업로드', () => {
  it('컬럼 순서와 불필요한 컬럼에 상관없이 필요한 다섯 필드만 읽는다', () => {
    const rows = [
      ['공급처', '정상재고', '상품명', '원가합', '메모', '상품코드', '원가'],
      ['거래처A', '10', '상품A', '9,500', '저장하지 않음', '00001', '1,000'],
    ];
    const result = parseInventoryWorkbook(buildXlsxBuffer(rows));

    expect(result.issues.filter((issue) => issue.level === 'ERROR')).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      productCode: '00001',
      productName: '상품A',
      unitCost: 1000,
      totalCost: 9500,
      normalStock: 10,
      availableStock: 10,
      extra: {},
    });
  });

  it('품목코드·품목명·매입단가·재고수량 같은 별칭도 인식한다', () => {
    const rows = [
      ['품목명', '재고수량', '품목코드', '매입단가'],
      ['상품B', '7', 'SKU-2', '1,250원'],
    ];
    const result = parseInventoryWorkbook(buildXlsxBuffer(rows));

    expect(result.issues.filter((issue) => issue.level === 'ERROR')).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ productCode: 'SKU-2', productName: '상품B', unitCost: 1250, totalCost: null, normalStock: 7 });
  });

  it('원가와 원가합 헤더가 모두 없어도 업로드하고 원가 누락을 표시한다', () => {
    const rows = [
      ['상품코드', '상품명', '정상재고'],
      ['A-1', '상품A', '5'],
    ];
    const result = parseInventoryWorkbook(buildXlsxBuffer(rows));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].costMissing).toBe(true);
    expect(result.rows[0].unitCost).toBe(0);
    expect(result.rows[0].totalCost).toBeNull();
    expect(result.issues.some((issue) => issue.code === 'COST_MISSING' && issue.level === 'WARNING')).toBe(true);
  });

  it('필수 헤더가 없으면 저장하지 않는다', () => {
    const rows = [['상품명', '정상재고'], ['상품A', '100']];
    const result = parseInventoryWorkbook(buildXlsxBuffer(rows));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === 'MISSING_REQUIRED_COLUMN' && issue.column === 'productCode')).toBe(true);
  });

  it('상품코드·상품명 누락과 상품코드 중복을 거부한다', () => {
    const rows = [
      ['상품코드', '상품명', '정상재고'],
      ['', '상품A', '1'],
      ['A', '', '1'],
      ['B', '상품B', '1'],
      ['B', '상품B-2', '2'],
    ];
    const result = parseInventoryWorkbook(buildXlsxBuffer(rows));

    expect(result.rows).toHaveLength(1);
    expect(result.issues.some((issue) => issue.code === 'MISSING_PRODUCT_CODE')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'MISSING_PRODUCT_NAME')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'DUPLICATE_PRODUCT_CODE')).toBe(true);
  });

  it('정상재고는 정수여야 하고 숫자 범위를 검사한다', () => {
    const decimal = parseInventoryWorkbook(buildXlsxBuffer([['상품코드', '상품명', '정상재고'], ['A', '상품A', '1.5']]));
    const overflow = parseInventoryWorkbook(buildXlsxBuffer([['상품코드', '상품명', '정상재고'], ['A', '상품A', '99999999999']]));

    expect(decimal.rows).toHaveLength(0);
    expect(decimal.issues.some((issue) => issue.code === 'NUMBER_NOT_INTEGER')).toBe(true);
    expect(overflow.rows).toHaveLength(0);
    expect(overflow.issues.some((issue) => issue.code === 'NUMBER_OUT_OF_RANGE')).toBe(true);
  });

  it('헤더만 있고 데이터가 없으면 오류를 반환한다', () => {
    const result = parseInventoryWorkbook(buildXlsxBuffer([['상품코드', '상품명', '정상재고']]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === 'NO_DATA_ROWS')).toBe(true);
  });
});

describe('parseInventoryWorkbook - HTML 기반 유사-xls', () => {
  it('최소 헤더를 가진 HTML table도 정상 파싱한다', () => {
    const html = `
      <html><body><table>
      <tr><td>상품코드</td><td>상품명</td><td>원가</td><td>정상재고</td></tr>
      <tr><td>00001</td><td>A&#40;special&#x29;</td><td>1,200</td><td>420</td></tr>
      </table></body></html>
    `;
    const result = parseInventoryWorkbook(Buffer.from(html, 'utf-8'));

    expect(result.issues.filter((issue) => issue.level === 'ERROR')).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ productCode: '00001', productName: 'A(special)', unitCost: 1200, normalStock: 420, availableStock: 420 });
  });
});
