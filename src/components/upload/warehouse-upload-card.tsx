'use client';

import { useRef, useState } from 'react';
import { UploadCloud, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatKstDate, formatKstDateTime, todayKstDateString } from '@/lib/date';

interface ValidationIssue {
  level: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

interface WarehouseUploadCardProps {
  warehouse: { id: string; code: string; name: string };
  latestSnapshot: { snapshotDate: string; rowCount: number; uploadedAt: string } | null;
}

type UiState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'error'; issues: ValidationIssue[] }
  | { phase: 'success'; rowCount: number; issues: ValidationIssue[] };

export function WarehouseUploadCard({ warehouse, latestSnapshot }: WarehouseUploadCardProps) {
  const [snapshotDate, setSnapshotDate] = useState(todayKstDateString());
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
  const [conflict, setConflict] = useState<{ uploadedAt: string; uploadedByName: string; rowCount: number; version: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(replaceExisting: boolean) {
    if (!file) {
      toast.error('업로드할 Excel 파일을 선택하세요.');
      return;
    }
    setState({ phase: 'uploading' });
    const formData = new FormData();
    formData.append('warehouseId', warehouse.id);
    formData.append('snapshotDate', snapshotDate);
    formData.append('replaceExisting', String(replaceExisting));
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await res.json();

      if (res.status === 409) {
        setConflict(body.existing);
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

      setState({ phase: 'success', rowCount: body.rowCount, issues: body.issues });
      toast.success(`${warehouse.name}: ${body.rowCount}건 저장 완료`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast.error('네트워크 오류로 업로드에 실패했습니다.');
      setState({ phase: 'idle' });
    }
  }

  const errorIssues = state.phase === 'error' ? state.issues.filter((i) => i.level === 'ERROR') : [];
  const warningIssues = state.phase === 'success' ? state.issues.filter((i) => i.level === 'WARNING') : [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{warehouse.name}</CardTitle>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{warehouse.code}</span>
          </div>
          <CardDescription>
            {latestSnapshot ? (
              <>
                최근 스냅샷: {formatKstDate(latestSnapshot.snapshotDate)} · {latestSnapshot.rowCount.toLocaleString()}건 · {formatKstDateTime(latestSnapshot.uploadedAt)} 업로드
              </>
            ) : (
              '아직 업로드된 스냅샷이 없습니다.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`date-${warehouse.id}`}>재고 기준일</Label>
            <Input id={`date-${warehouse.id}`} type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} max={todayKstDateString()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`file-${warehouse.id}`}>Excel 파일 (.xls, .xlsx)</Label>
            <Input
              ref={fileInputRef}
              id={`file-${warehouse.id}`}
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button className="w-full" onClick={() => submit(false)} disabled={state.phase === 'uploading' || !file}>
            <UploadCloud className="size-4" />
            {state.phase === 'uploading' ? '업로드 중...' : '업로드'}
          </Button>

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
              {errorIssues.length > 8 && <div className="mt-1">외 {errorIssues.length - 8}건</div>}
            </div>
          )}

          {state.phase === 'success' && (
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
          )}
        </CardContent>
      </Card>

      <Dialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이미 존재하는 스냅샷입니다</DialogTitle>
            <DialogDescription>
              {warehouse.name}의 {formatKstDate(snapshotDate)} 기준 스냅샷이 이미 있습니다 ({conflict?.rowCount.toLocaleString()}건,{' '}
              {conflict?.uploadedByName}, {conflict ? formatKstDateTime(conflict.uploadedAt) : ''} 업로드). 새 파일로 교체하시겠습니까? 기존
              스냅샷은 이력으로 보존되고 최신 버전만 분석에 사용됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflict(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                setConflict(null);
                submit(true);
              }}
            >
              교체하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
