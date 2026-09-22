import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { buildTemplateSheet, type TemplateType } from '@/domain/excel/templates';

/** 설정/업로드 화면의 "샘플파일 다운로드" 버튼이 쓰는 공용 응답 빌더. */
export function templateDownloadResponse(type: TemplateType): NextResponse {
  const sheet = buildTemplateSheet(type);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
  XLSX.utils.book_append_sheet(wb, ws, '업로드양식');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template.xlsx"; filename*=UTF-8''${encodeURIComponent(sheet.fileName)}`,
    },
  });
}
