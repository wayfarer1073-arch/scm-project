'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Info, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatKstDate, formatKstDateTime } from '@/lib/date';

interface ValidationIssue {
  level: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

interface CalendarUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseName: string;
  date: string;
  existing: { uploadedByName: string; uploadedAt: string; rowCount: number };
}

type UiState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'error'; issues: ValidationIssue[] }
  | { phase: 'duplicate' }
  | { phase: 'success' };

export function CalendarUploadDialog({ open, onOpenChange, warehouseId, warehouseName, date, existing }: CalendarUploadDialogProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file) {
      toast.error('업로드할 Excel 파일을 선택하세요.');
      return;
    }
    setState({ phase: 'uploading' });
    const formData = new FormData();
    formData.append('warehouseId', warehouseId);
    formData.append('snapshotDate', date);
    formData.append('replaceExisting', 'true');
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await res.json();

      if (res.status === 422) {
        setState({ phase: 'error', issues: body.issues });
        return;
      }
      if (!res.ok) {
        toast.error(body.error ?? '업로드 중 오류가 발생했습니다.');
        setState({ phase: 'idle' });
        return;
      }
      if (body.status === 'DUPLICATE') {
        setState({ phase: 'duplicate' });
        return;
      }

      setState({ phase: 'success' });
      toast.success(`${warehouseName}: ${body.rowCount}건 저장 완료`);
      router.refresh();
      onOpenChange(false);
    } catch {
      toast.error('네트워크 오류로 업로드에 실패했습니다.');
      setState({ phase: 'idle' });
    }
  }

  const errorIssues = state.phase === 'error' ? state.issues.filter((i) => i.level === 'ERROR') : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFile(null);
          setState({ phase: 'idle' });
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{warehouseName} · {formatKstDate(date)} 자료 교체</DialogTitle>
          <DialogDescription>기존에 올라온 자료를 새 파일로 교체합니다.</DialogDescription>
        </DialogHeader>

        <div role="alert" className="flex items-start gap-1.5 rounded-md border border-status-warning/30 bg-status-warning-bg p-2.5 text-xs text-status-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            해당 일자에 업로드된 재고 데이터가 있습니다. 교체하시겠습니까? ({existing.uploadedByName}님이 {formatKstDateTime(existing.uploadedAt)}에 올린{' '}
            {existing.rowCount.toLocaleString()}건)
          </span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="calendar-upload-file">Excel 파일 (.xls, .xlsx)</Label>
          <Input ref={fileInputRef} id="calendar-upload-file" type="file" accept=".xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>

        {state.phase === 'error' && (
          <div className="rounded-md border border-destructive/30 bg-status-danger-bg p-3 text-xs text-status-danger">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5" />
              파일 형식 오류로 저장하지 않았습니다
            </div>
            <ul className="list-disc space-y-0.5 pl-4">
              {errorIssues.slice(0, 8).map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        {state.phase === 'duplicate' && (
          <div className="rounded-md border bg-muted/60 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <Info className="size-3.5" />
              동일한 데이터입니다.
            </div>
            품목과 재고수량이 기존 자료와 완전히 동일하여 반영하지 않았습니다.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={submit} disabled={state.phase === 'uploading' || !file}>
            <UploadCloud className="size-4" />
            {state.phase === 'uploading' ? '업로드 중...' : '교체하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
