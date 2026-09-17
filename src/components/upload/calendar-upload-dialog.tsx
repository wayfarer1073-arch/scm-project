'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Info, Plus, Trash2, UploadCloud } from 'lucide-react';
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
  existing: { uploadedByName: string; uploadedAt: string; rowCount: number; inboundEntries: InboundDraft[] } | null;
}

interface InboundDraft {
  productIdentifier: string;
  quantity: string;
}

type UiState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'error'; issues: ValidationIssue[] }
  | { phase: 'duplicate' }
  | { phase: 'success'; rowCount: number; issues: ValidationIssue[] };

export function CalendarUploadDialog({ open, onOpenChange, warehouseId, warehouseName, date, existing }: CalendarUploadDialogProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
  const [inboundEntries, setInboundEntries] = useState<InboundDraft[]>(
    existing?.inboundEntries.length ? existing.inboundEntries : [{ productIdentifier: '', quantity: '' }],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file) {
      toast.error('업로드할 Excel 파일을 선택하세요.');
      return;
    }
    const partiallyFilled = inboundEntries.find((entry) => (entry.productIdentifier.trim() === '') !== (entry.quantity.trim() === ''));
    if (partiallyFilled) {
      toast.error('입고 특이사항은 상품명/상품코드와 수량을 함께 입력하세요.');
      return;
    }
    const submittedInboundEntries = inboundEntries
      .filter((entry) => entry.productIdentifier.trim() !== '' && entry.quantity.trim() !== '')
      .map((entry) => ({ productIdentifier: entry.productIdentifier.trim(), quantity: Number(entry.quantity) }));
    if (submittedInboundEntries.some((entry) => !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0)) {
      toast.error('입고 수량은 1 이상의 정수로 입력하세요.');
      return;
    }

    setState({ phase: 'uploading' });
    const formData = new FormData();
    formData.append('warehouseId', warehouseId);
    formData.append('snapshotDate', date);
    formData.append('replaceExisting', String(!!existing));
    formData.append('file', file);
    formData.append('inboundEntries', JSON.stringify(submittedInboundEntries));

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await res.json();

      if (res.status === 409) {
        toast.error('그사이 다른 사람이 자료를 올렸습니다. 새로고침 후 다시 시도해주세요.');
        setState({ phase: 'idle' });
        return;
      }
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

      setState({ phase: 'success', rowCount: body.rowCount, issues: body.issues ?? [] });
      toast.success(`${warehouseName}: ${body.rowCount}건 저장 완료`);
      router.refresh();
    } catch {
      toast.error('네트워크 오류로 업로드에 실패했습니다.');
      setState({ phase: 'idle' });
    }
  }

  const errorIssues = state.phase === 'error' ? state.issues.filter((i) => i.level === 'ERROR') : [];
  const warningIssues = state.phase === 'success' ? state.issues.filter((i) => i.level === 'WARNING') : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFile(null);
          setState({ phase: 'idle' });
          setInboundEntries(existing?.inboundEntries.length ? existing.inboundEntries : [{ productIdentifier: '', quantity: '' }]);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {warehouseName} · {formatKstDate(date)} 자료 {existing ? '교체' : '업로드'}
          </DialogTitle>
          <DialogDescription>{existing ? '기존에 올라온 자료를 새 파일로 교체합니다.' : '해당 일자·창고에 재고 스냅샷을 새로 업로드합니다.'}</DialogDescription>
        </DialogHeader>

        {state.phase === 'success' ? (
          <>
            <div className="rounded-md border border-status-normal/30 bg-status-normal-bg p-3 text-xs text-status-normal">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-3.5" />
                {state.rowCount.toLocaleString()}건 저장 완료
              </div>
              {warningIssues.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-status-warning">
                  {warningIssues.slice(0, 6).map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                  {warningIssues.length > 6 && <li>외 {warningIssues.length - 6}건 경고</li>}
                </ul>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>닫기</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {existing && (
              <div role="alert" className="flex items-start gap-1.5 rounded-md border border-status-warning/30 bg-status-warning-bg p-2.5 text-xs text-status-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  해당 일자에 업로드된 재고 데이터가 있습니다. 교체하시겠습니까? ({existing.uploadedByName}님이 {formatKstDateTime(existing.uploadedAt)}에 올린{' '}
                  {existing.rowCount.toLocaleString()}건)
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="calendar-upload-file">Excel 파일 (.xls, .xlsx)</Label>
              <Input ref={fileInputRef} id="calendar-upload-file" type="file" accept=".xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label>&lt;입고 특이사항&gt;</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    이 스냅샷까지 입고된 상품과 수량을 입력하면 추정 소진량에서 입고분을 보정합니다.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInboundEntries((entries) => [...entries, { productIdentifier: '', quantity: '' }])}
                  disabled={inboundEntries.length >= 100}
                >
                  <Plus className="size-3.5" /> 항목 추가
                </Button>
              </div>
              <div className="space-y-2">
                {inboundEntries.map((entry, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
                    <Input
                      aria-label={`입고 상품 ${index + 1}`}
                      placeholder="상품명 또는 상품코드"
                      value={entry.productIdentifier}
                      onChange={(event) => setInboundEntries((entries) => entries.map((item, itemIndex) => itemIndex === index ? { ...item, productIdentifier: event.target.value } : item))}
                    />
                    <Input
                      aria-label={`입고 수량 ${index + 1}`}
                      type="number"
                      min={1}
                      step={1}
                      placeholder="수량"
                      value={entry.quantity}
                      onChange={(event) => setInboundEntries((entries) => entries.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`입고 항목 ${index + 1} 삭제`}
                      onClick={() => setInboundEntries((entries) => entries.length === 1 ? [{ productIdentifier: '', quantity: '' }] : entries.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {state.phase === 'error' && (
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

            {state.phase === 'duplicate' && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-status-danger-bg p-3 text-xs text-status-danger">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <Info className="size-3.5" />
                  동일한 데이터입니다.
                </div>
                품목·재고수량·입고 특이사항이 기존 자료와 완전히 동일하여 반영하지 않았습니다.
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button onClick={submit} disabled={state.phase === 'uploading' || !file}>
                <UploadCloud className="size-4" />
                {state.phase === 'uploading' ? '업로드 중...' : existing ? '교체하기' : '업로드'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
