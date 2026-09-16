'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatKstDate, formatKstDateTime, todayKstDateString, yesterdayKstDateString } from '@/lib/date';

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
  | { phase: 'success'; rowCount: number; issues: ValidationIssue[] }
  | { phase: 'duplicate'; snapshotDate: string; uploadedAt: string; uploadedByName: string; rowCount: number };

type ExistingSnapshot = { rowCount: number; uploadedAt: string; uploadedByName: string; version: number };

type PastDateCheck = { status: 'idle' | 'checking' | 'done'; existing: ExistingSnapshot | null };

export function WarehouseUploadCard({ warehouse, latestSnapshot }: WarehouseUploadCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'today' | 'past'>('today');
  const [pastDate, setPastDate] = useState(yesterdayKstDateString());
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
  const [conflict, setConflict] = useState<{ uploadedAt: string; uploadedByName: string; rowCount: number; version: number } | null>(null);
  const [pastCheck, setPastCheck] = useState<PastDateCheck>({ status: 'idle', existing: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveDate = mode === 'today' ? todayKstDateString() : pastDate;

  useEffect(() => {
    if (mode !== 'past' || !pastDate) return;
    let cancelled = false;
    setPastCheck({ status: 'checking', existing: null });
    fetch(`/api/warehouses/${warehouse.id}/snapshot-check?date=${pastDate}`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setPastCheck({ status: 'done', existing: body.exists ? body.snapshot : null });
      })
      .catch(() => {
        if (!cancelled) setPastCheck({ status: 'done', existing: null });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, pastDate, warehouse.id]);

  function switchMode(next: 'today' | 'past') {
    setMode(next);
    setFile(null);
    setState({ phase: 'idle' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submit(replaceExisting: boolean) {
    if (!file) {
      toast.error('업로드할 Excel 파일을 선택하세요.');
      return;
    }
    setState({ phase: 'uploading' });
    const formData = new FormData();
    formData.append('warehouseId', warehouse.id);
    formData.append('snapshotDate', effectiveDate);
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
      if (body.status === 'DUPLICATE') {
        setState({
          phase: 'duplicate',
          snapshotDate: body.existing.snapshotDate,
          uploadedAt: body.existing.uploadedAt,
          uploadedByName: body.existing.uploadedByName,
          rowCount: body.existing.rowCount,
        });
        toast.message('내용이 동일한 파일이라 저장하지 않았습니다.');
        return;
      }

      setState({ phase: 'success', rowCount: body.rowCount, issues: body.issues });
      toast.success(`${warehouse.name}: ${body.rowCount}건 저장 완료`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPastCheck({ status: 'idle', existing: null });
      router.refresh();
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
          <Tabs value={mode} onValueChange={(v) => switchMode(v as 'today' | 'past')}>
            <TabsList className="w-full">
              <TabsTrigger value="today">오늘 자료</TabsTrigger>
              <TabsTrigger value="past">과거 자료</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'today' ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">재고 기준일</span> <span className="font-medium">{formatKstDate(effectiveDate)} (오늘)</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`date-${warehouse.id}`}>재고 기준일 (과거)</Label>
              <Input
                id={`date-${warehouse.id}`}
                type="date"
                value={pastDate}
                onChange={(e) => setPastDate(e.target.value)}
                max={yesterdayKstDateString()}
              />
              {pastCheck.status === 'done' && pastCheck.existing && (
                <div role="alert" className="flex items-start gap-1.5 rounded-md border border-status-warning/30 bg-status-warning-bg p-2.5 text-xs text-status-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    이 날짜엔 이미 {pastCheck.existing.uploadedByName}님이 {formatKstDateTime(pastCheck.existing.uploadedAt)}에 올린 자료(
                    {pastCheck.existing.rowCount.toLocaleString()}건)가 있습니다. 업로드를 진행하면 교체 여부를 다시 확인합니다.
                  </span>
                </div>
              )}
            </div>
          )}

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

          {state.phase === 'duplicate' && (
            <div className="rounded-md border bg-muted/60 p-3 text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Info className="size-3.5" />
                동일한 내용의 파일이라 저장하지 않았습니다
              </div>
              파일명과 관계없이 {formatKstDate(state.snapshotDate)} 기준으로 {state.uploadedByName}님이{' '}
              {formatKstDateTime(state.uploadedAt)}에 올린 스냅샷({state.rowCount.toLocaleString()}건)과 내용이 완전히 동일합니다.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'past' ? '과거 데이터를 덮어쓰시겠습니까?' : '이미 존재하는 스냅샷입니다'}</DialogTitle>
            <DialogDescription>
              {warehouse.name}의 {formatKstDate(effectiveDate)} 기준 스냅샷이 이미 있습니다 ({conflict?.rowCount.toLocaleString()}건,{' '}
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
