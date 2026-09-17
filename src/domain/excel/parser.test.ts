import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseInventoryWorkbook } from './parser';

function buildXlsxBuffer(aoa: (string | number)[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return out as Buffer;
}

const HEADER = ['상품코드', '상품명', '옵션', '바코드', '원가', '정상재고', '가용재고', '입고대기', '불량재고', '경고수량', '위험수량', '로케이션'];

describe('parseInventoryWorkbook - 정상 xlsx', () => {
  it('헤더명 기준으로 컬럼 순서가 달라도 정확히 매핑한다', () => {
    // 컬럼 순서를 표준과 다르게 섞는다
    const shuffledHeader = ['상품명', '상품코드', '가용재고', '원가', '정상재고', '바코드', '옵션', '입고대기', '불량재고', '위험수량', '경고수량', '로케이션'];
    const rows = [shuffledHeader, ['테스트상품', '00001', '850', '1000', '900', '8801234567890', '', '0', '0', '20', '50', 'A-01-01']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.issues.filter((i) => i.level === 'ERROR')).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].productCode).toBe('00001');
    expect(result.rows[0].availableStock).toBe(850);
    expect(result.rows[0].unitCost).toBe(1000);
    expect(result.rows[0].dangerQty).toBe(20);
    expect(result.rows[0].warningQty).toBe(50);
  });

  it('콤마 천단위 구분자와 공백을 normalize한다', () => {
    const rows = [HEADER, ['00002', '상품B', '', '', '1,500', '1,000', '900', '0', '0', '10', '5', ' A-02 ']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows[0].unitCost).toBe(1500);
    expect(result.rows[0].normalStock).toBe(1000);
    expect(result.rows[0].location).toBe('A-02');
  });

  it('빈 재고 수량 셀은 0으로 처리한다', () => {
    const rows = [HEADER, ['00003', '상품C', '', '', '1000', '', '', '', '', '', '', '']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows[0].normalStock).toBe(0);
    expect(result.rows[0].availableStock).toBe(0);
  });
});

describe('parseInventoryWorkbook - 검증 규칙', () => {
  it('필수 컬럼이 없으면 ERROR를 반환하고 저장하지 않는다', () => {
    const rows = [['상품명', '가용재고'], ['상품A', '100']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_COLUMN')).toBe(true);
  });

  it('헤더만 있고 상품 데이터가 한 건도 없으면 ERROR를 반환한다(회귀 테스트)', () => {
    const rows = [HEADER];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'NO_DATA_ROWS' && i.level === 'ERROR')).toBe(true);
  });

  it('상품코드 누락 행은 ERROR로 표시되고 제외된다', () => {
    const rows = [HEADER, ['', '상품A', '', '', '1000', '10', '10', '0', '0', '0', '0', '']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'MISSING_PRODUCT_CODE')).toBe(true);
  });

  it('상품코드 중복은 ERROR로 표시된다', () => {
    const rows = [HEADER, ['00001', '상품A', '', '', '1000', '10', '10', '0', '0', '0', '0', ''], ['00001', '상품A2', '', '', '1000', '5', '5', '0', '0', '0', '0', '']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_PRODUCT_CODE')).toBe(true);
  });

  it('숫자로 파싱할 수 없는 값은 ERROR로 표시되고 해당 행은 제외된다', () => {
    const rows = [HEADER, ['00001', '상품A', '', '', '원가없음', '10', '10', '0', '0', '0', '0', '']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'NUMBER_PARSE_FAILED')).toBe(true);
  });

  it('원가 누락은 WARNING이며 행은 저장된다', () => {
    const rows = [HEADER, ['00001', '상품A', '', '', '', '10', '10', '0', '0', '0', '0', '']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.issues.some((i) => i.code === 'COST_MISSING' && i.level === 'WARNING')).toBe(true);
  });

  it('음수 재고는 WARNING이며 행은 저장된다', () => {
    const rows = [HEADER, ['00001', '상품A', '', '', '1000', '-5', '-5', '0', '0', '0', '0', '']];
    const buffer = buildXlsxBuffer(rows);
    const result = parseInventoryWorkbook(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.issues.some((i) => i.code === 'NEGATIVE_STOCK' && i.level === 'WARNING')).toBe(true);
  });
});

describe('parseInventoryWorkbook - HTML 기반 유사-xls 파일', () => {
  it('사방넷류 ERP가 내보내는 HTML table 형식(.xls 확장자)을 정상 파싱한다', () => {
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office">
      <head><style>.style1{mso-number-format:\\@;}</style></head>
      <body><table border=1>
      <tr><td class=header>상품코드</td><td class=header>상품명</td><td class=header>옵션</td><td class=header>바코드</td><td class=header>원가</td><td class=header>정상재고</td><td class=header>가용재고</td><td class=header>입고대기</td><td class=header>불량재고</td><td class=header>경고수량</td><td class=header>위험수량</td><td class=header>로케이션</td></tr>
      <tr><td class='style1'>00001</td><td class='style1'>(MH)포켓몬 츄잉팝스 젤리 70g</td><td class='style1'></td><td class='style1'>8809585965863</td><td class='style2'>1,200</td><td class='style3'>500</td><td class='style2'><span class='zero_color'>420</span></td><td class='style2'>0</td><td class='style2'>0</td><td class='style2'>50</td><td class='style2'>20</td><td class='style1'>E01-06-01</td></tr>
      </table></body></html>
    `;
    const buffer = Buffer.from(html, 'utf-8');
    const result = parseInventoryWorkbook(buffer);
    expect(result.issues.filter((i) => i.level === 'ERROR')).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].productCode).toBe('00001');
    expect(result.rows[0].availableStock).toBe(420);
    expect(result.rows[0].unitCost).toBe(1200);
    expect(result.rows[0].productName).toBe('(MH)포켓몬 츄잉팝스 젤리 70g');
  });
});
