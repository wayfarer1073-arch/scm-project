'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Check, X, UploadCloud, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatKstDate, todayKstDateString } from '@/lib/date';
import { DEFAULT_EXPIRATION_RISK_DAYS } from '@/domain/inventory/types';

interface ExpirationRow {
  skuId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  expirationDate: string;
  expirationRiskDays: number | null;
}

interface ExpirationManagementProps {
  isAdmin: boolean;
  warehouses: { id: string; code: string; name: string }[];
  initialEntries: ExpirationRow[];
}

function daysUntil(dateStr: string): number {
  const today = todayKstDateString();
  const diffMs = Date.parse(`${dateStr}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`);
  return Math.round(diffMs / 86_400_000);
}

function expirationBadge(days: number): { label: string; className: string } {
  if (days < 0) return { label: `만료 ${Math.abs(days)}일 경과`, className: 'bg-status-danger-bg text-status-danger' };
  if (days <= 7) return { label: `D-${days}`, className: 'bg-status-danger-bg text-status-danger' };
  if (days <= 30) return { label: `D-${days}`, className: 'bg-status-warning-bg text-status-warning' };
  return { label: `D-${days}`, className: 'bg-muted text-muted-foreground' };
}

export function ExpirationManagement({ isAdmin, warehouses, initialEntries }: ExpirationManagementProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingRiskDaysValue, setEditingRiskDaysValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingSkuId, setDeletingSkuId] = useState<string | null>(null);
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [bulkRiskDaysInput, setBulkRiskDaysInput] = useState('');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');

  const visibleEntries = warehouseFilter === 'ALL' ? entries : entries.filter((e) => e.warehouseId === warehouseFilter);
  const allSelected = visibleEntries.length > 0 && visibleEntries.every((e) => selectedSkuIds.has(e.skuId));

  function toggleSelect(skuId: string, checked: boolean) {
    setSelectedSkuIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(skuId);
      else next.delete(skuId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedSkuIds((prev) => {
      const next = new Set(prev);
      for (const e of visibleEntries) {
        if (checked) next.add(e.skuId);
        else next.delete(e.skuId);
      }
      return next;
    });
  }

  async function refreshEntries() {
    const res = await fetch('/api/expiration');
    if (res.ok) {
      const body = await res.json();
      setEntries(body.entries ?? []);
    }
  }

  async function handleUpload() {
    if (!warehouseId || !file) {
      toast.error('창고와 Excel 파일을 선택하세요.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('warehouseId', warehouseId);
      formData.append('file', file);
      const res = await fetch('/api/expiration', { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? body.issues?.[0]?.message ?? '업로드에 실패했습니다.');
        return;
      }
      const unmatchedText = body.unmatchedProductCodes.length > 0 ? ` · 인식되지 않은 상품코드 ${body.unmatchedProductCodes.length}건` : '';
      toast.success(`${body.updatedCount}건 반영${unmatchedText}`);
      await refreshEntries();
      setFile(null);
    } catch {
      toast.error('네트워크 오류로 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }

  function startEdit(entry: ExpirationRow) {
    setEditingSkuId(entry.skuId);
    setEditingValue(entry.expirationDate);
    setEditingRiskDaysValue(String(entry.expirationRiskDays ?? DEFAULT_EXPIRATION_RISK_DAYS));
  }

  async function saveEdit(skuId: string) {
    if (!editingValue) {
      toast.error('날짜를 입력하세요.');
      return;
    }
    const riskDays = Number(editingRiskDaysValue);
    if (!Number.isInteger(riskDays) || riskDays < 0) {
      toast.error('위험 판정 일수는 0 이상의 정수여야 합니다.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/expiration/${skuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expirationDate: editingValue, expirationRiskDays: riskDays }),
      });
      if (!res.ok) throw new Error();
      setEntries((prev) =>
        prev
          .map((e) => (e.skuId === skuId ? { ...e, expirationDate: editingValue, expirationRiskDays: riskDays } : e))
          .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate)),
      );
      toast.success('소비기한을 수정했습니다.');
      setEditingSkuId(null);
    } catch {
      toast.error('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function applyBulkRiskDays() {
    const riskDays = Number(bulkRiskDaysInput);
    if (!Number.isInteger(riskDays) || riskDays < 0) {
      toast.error('위험 판정 일수는 0 이상의 정수여야 합니다.');
      return;
    }
    setBulkApplying(true);
    try {
      const res = await fetch('/api/expiration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuIds: [...selectedSkuIds], expirationRiskDays: riskDays }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? '일괄 적용에 실패했습니다.');
        return;
      }
      setEntries((prev) => prev.map((e) => (selectedSkuIds.has(e.skuId) ? { ...e, expirationRiskDays: riskDays } : e)));
      toast.success(`${body.updatedCount}건에 위험 판정 일수를 적용했습니다.`);
      setSelectedSkuIds(new Set());
      setBulkRiskDaysInput('');
    } catch {
      toast.error('네트워크 오류로 일괄 적용에 실패했습니다.');
    } finally {
      setBulkApplying(false);
    }
  }

  async function deleteExpiration(entry: ExpirationRow) {
    if (!confirm(`${entry.productName}의 소비기한 항목을 삭제할까요?`)) return;

    setDeletingSkuId(entry.skuId);
    try {
      const res = await fetch(`/api/expiration/${entry.skuId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? '삭제에 실패했습니다.');
        return;
      }
      setEntries((prev) => prev.filter((item) => item.skuId !== entry.skuId));
      if (editingSkuId === entry.skuId) setEditingSkuId(null);
      setSelectedSkuIds((prev) => {
        if (!prev.has(entry.skuId)) return prev;
        const next = new Set(prev);
        next.delete(entry.skuId);
        return next;
      });
      toast.success('소비기한 항목을 삭제했습니다.');
    } catch {
      toast.error('네트워크 오류로 삭제에 실패했습니다.');
    } finally {
      setDeletingSkuId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>소비기한 관리</CardTitle>
        <CardDescription>
          창고를 고르고 유통기한 Excel을 올리면 그 창고에서 관리 중인(캘린더 업로드로 인식된) SKU의 소비기한을 반영합니다. 인식되지 않는 상품코드는
          건너뜁니다. 날짜는 Excel 업로드 없이 바로 수정할 수도 있습니다. 위험 판정 일수(소비기한까지 이 일수 이하로 남았을 때 &quot;임박&quot;으로
          볼 기준)는 항목별로 수정하거나, 여러 항목을 체크해 한 번에 같은 값으로 적용할 수 있습니다.
          상품별 소비기한은 대표값 1개이며, 같은 상품이 여러 행이면 가장 이른 날짜를 사용합니다. 로트별 잔량과 폐기 예상 수량은 계산하지 않습니다.
          수정한 날짜와 위험 기준은 과거 기준일 조회에도 적용됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="expiration-warehouse">창고</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger id="expiration-warehouse" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiration-file">유통기한 Excel (.xls, .xlsx)</Label>
              <Input id="expiration-file" type="file" accept=".xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-xs" />
            </div>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              <UploadCloud className="size-4" />
              {uploading ? '업로드 중...' : '업로드'}
            </Button>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">등록된 소비기한이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            <Tabs value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <TabsList>
                <TabsTrigger value="ALL">전체</TabsTrigger>
                {warehouses.map((w) => (
                  <TabsTrigger key={w.id} value={w.id}>
                    {w.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2.5">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleSelectAll(checked === true)} aria-label="전체 선택" />
                  전체 선택
                </label>
                {selectedSkuIds.size > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">{selectedSkuIds.size}개 선택됨</span>
                    <Input
                      value={bulkRiskDaysInput}
                      onChange={(e) => setBulkRiskDaysInput(e.target.value)}
                      placeholder="위험 판정 일수"
                      inputMode="numeric"
                      className="h-8 w-32 text-xs"
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={applyBulkRiskDays} disabled={bulkApplying || !bulkRiskDaysInput}>
                      선택 항목 일괄 적용
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedSkuIds(new Set())} disabled={bulkApplying}>
                      선택 해제
                    </Button>
                  </>
                )}
              </div>
            )}

            {visibleEntries.length === 0 && <p className="text-xs text-muted-foreground">이 창고에는 등록된 소비기한이 없습니다.</p>}

            {visibleEntries.map((entry) => {
              const isEditing = editingSkuId === entry.skuId;
              const badge = expirationBadge(daysUntil(entry.expirationDate));
              const riskDaysLabel = `위험판정 D-${entry.expirationRiskDays ?? DEFAULT_EXPIRATION_RISK_DAYS}`;
              return (
                <div key={entry.skuId} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {isAdmin && (
                      <Checkbox
                        checked={selectedSkuIds.has(entry.skuId)}
                        onCheckedChange={(checked) => toggleSelect(entry.skuId, checked === true)}
                        aria-label={`${entry.productName} 선택`}
                        className="shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="shrink-0 text-[11px]">
                          {entry.warehouseCode}
                        </Badge>
                        <span className="truncate font-medium">{entry.productName}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{entry.productCode}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isEditing ? (
                      <>
                        <Input type="date" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="h-8 w-36 text-xs" />
                        <Input
                          value={editingRiskDaysValue}
                          onChange={(e) => setEditingRiskDaysValue(e.target.value)}
                          placeholder="위험판정 일수"
                          inputMode="numeric"
                          className="h-8 w-20 text-xs"
                          aria-label="소비기한 위험 판정 일수"
                        />
                        <Button size="icon" variant="ghost" className="size-7" disabled={saving} onClick={() => saveEdit(entry.skuId)} aria-label="저장">
                          <Check className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" disabled={saving} onClick={() => setEditingSkuId(null)} aria-label="취소">
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatKstDate(entry.expirationDate)}</span>
                        <span className="text-[11px] text-muted-foreground">{riskDaysLabel}</span>
                        {isAdmin && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              disabled={deletingSkuId === entry.skuId}
                              onClick={() => startEdit(entry)}
                              aria-label={`${entry.productName} 소비기한 수정`}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={deletingSkuId === entry.skuId}
                              onClick={() => deleteExpiration(entry)}
                              aria-label={`${entry.productName} 소비기한 삭제`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
