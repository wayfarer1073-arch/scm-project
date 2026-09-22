'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Download, Info, RotateCcw, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InboundManager } from '@/components/upload/inbound-manager';
import { formatKstDate, formatKstDateTime } from '@/lib/date';

interface ValidationIssue {
  level: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

interface WarehouseDayPanelProps {
  warehouseId: string;
  warehouseName: string;
  date: string;
  existing: { uploadedByName: string; uploadedAt: string; rowCount: number } | null;
  blocked: boolean;
  isAdmin: boolean;
}

/** 하루·한 창고 분량의 업로드 폼 + 입고 특이사항. 날짜 패널(DayDetailDialog)의 탭 하나의 내용이다. */
export function WarehouseDayPanel({ warehouseId, warehouseName, date, existing, blocked, isAdmin }: WarehouseDayPanelProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [duplicate, setDuplicate] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function resetUpload() {
    if (!confirm(`${warehouseName} · ${formatKstDate(date)}에 올라온 재고 데이터와 입고 기록을 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/upload?warehouseId=${encodeURIComponent(warehouseId)}&snapshotDate=${encodeURIComponent(date)}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? '초기화에 실패했습니다.');
        return;
      }
      toast.success('업로드 자료를 초기화했습니다.');
      router.refresh();
    } catch {
      toast.error('네트워크 오류로 초기화에 실패했습니다.');
    } finally {
      setResetting(false);
    }
  }

  async function submit() {
    if (!file) {
      toast.error('업로드할 Excel 파일을 선택하세요.');
      return;
    }

    setUploading(true);
    setIssues([]);
    setDuplicate(false);
    const formData = new FormData();
    formData.append('warehouseId', warehouseId);
    formData.append('snapshotDate', date);
    formData.append('replaceExisting', String(!!existing));
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await res.json();

      if (res.status === 409) {
        toast.error('그사이 다른 사람이 자료를 올렸습니다. 새로고침 후 다시 시도해주세요.');
        return;
      }
      if (res.status === 422) {
        setIssues(body.issues ?? []);
        return;
      }
      if (!res.ok) {
        toast.error(body.error ?? '업로드 중 오류가 발생했습니다.');
        return;
      }
      if (body.status === 'DUPLICATE') {
        setDuplicate(true);
        return;
      }

      toast.success(`${warehouseName}: ${body.rowCount.toLocaleString()}건 저장 완료`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch {
      toast.error('네트워크 오류로 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }

  const errorIssues = issues.filter((i) => i.level === 'ERROR');

  return (
    <div className="space-y-3">
      {existing && !blocked && (
        <div role="alert" className="flex items-start gap-1.5 rounded-md border border-status-warning/30 bg-status-warning-bg p-2.5 text-xs text-status-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            해당 일자에 업로드된 재고 데이터가 있습니다. 교체하시겠습니까? ({existing.uploadedByName}님이 {formatKstDateTime(existing.uploadedAt)}에 올린{' '}
            {existing.rowCount.toLocaleString()}건)
          </span>
        </div>
      )}

      {existing && blocked && (
        <p className="text-xs text-muted-foreground">
          {existing.uploadedByName}님이 {formatKstDateTime(existing.uploadedAt)}에 올린 {existing.rowCount.toLocaleString()}건이 있습니다.
        </p>
      )}

      {blocked && !existing && <p className="text-xs text-muted-foreground">주말·공휴일에는 자료를 업로드할 수 없습니다.</p>}

      {!blocked && (
        <div className="space-y-1.5">
          <Label htmlFor={`warehouse-day-file-${warehouseId}`}>Excel 파일 (.xls, .xlsx)</Label>
          <Input
            ref={fileInputRef}
            id={`warehouse-day-file-${warehouseId}`}
            type="file"
            accept=".xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            상품코드·상품명·정상재고 헤더만 필수입니다. 원가·원가합은 선택이며, 다른 열은 저장하지 않습니다.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={submit} disabled={uploading || !file}>
              <UploadCloud className="size-4" />
              {uploading ? '업로드 중...' : existing ? '교체하기' : '업로드'}
            </Button>
            <Button variant="outline" size="sm" className="text-foreground hover:text-brand-accent" asChild>
              <a href="/api/templates/inventory">
                <Download className="size-3.5" />
                샘플파일 다운로드
              </a>
            </Button>
            {existing && isAdmin && (
              <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={resetUpload} disabled={resetting}>
                <RotateCcw className="size-4" />
                {resetting ? '초기화 중...' : '초기화'}
              </Button>
            )}
          </div>
        </div>
      )}

      {errorIssues.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-status-danger-bg p-3 text-xs text-status-danger">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5" />
            업로드 내용을 확인해주세요
          </div>
          <ul className="list-disc space-y-0.5 pl-4">
            {errorIssues.slice(0, 8).map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {duplicate && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-status-danger-bg p-3 text-xs text-status-danger">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <Info className="size-3.5" />
            동일한 데이터입니다.
          </div>
          상품·원가·원가합·정상재고가 기존 자료와 완전히 동일하여 반영하지 않았습니다.
        </div>
      )}

      {existing && blocked && isAdmin && (
        <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={resetUpload} disabled={resetting}>
          <RotateCcw className="size-4" />
          {resetting ? '초기화 중...' : '초기화'}
        </Button>
      )}

      <InboundManager warehouseId={warehouseId} date={date} />
    </div>
  );
}
