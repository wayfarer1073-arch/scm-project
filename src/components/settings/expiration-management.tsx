'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Check, X, UploadCloud } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatKstDate, todayKstDateString } from '@/lib/date';

interface ExpirationRow {
  skuId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  expirationDate: string;
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
  const [saving, setSaving] = useState(false);

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
  }

  async function saveEdit(skuId: string) {
    if (!editingValue) {
      toast.error('날짜를 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/expiration/${skuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expirationDate: editingValue }),
      });
      if (!res.ok) throw new Error();
      setEntries((prev) =>
        prev.map((e) => (e.skuId === skuId ? { ...e, expirationDate: editingValue } : e)).sort((a, b) => a.expirationDate.localeCompare(b.expirationDate)),
      );
      toast.success('소비기한을 수정했습니다.');
      setEditingSkuId(null);
    } catch {
      toast.error('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>소비기한 관리</CardTitle>
        <CardDescription>
          창고를 고르고 유통기한 Excel을 올리면 그 창고에서 관리 중인(캘린더 업로드로 인식된) SKU의 소비기한을 반영합니다. 인식되지 않는 상품코드는
          건너뜁니다. 날짜는 Excel 업로드 없이 바로 수정할 수도 있습니다.
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
          <div className="space-y-1.5">
            {entries.map((entry) => {
              const isEditing = editingSkuId === entry.skuId;
              const badge = expirationBadge(daysUntil(entry.expirationDate));
              return (
                <div key={entry.skuId} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="shrink-0 text-[11px]">
                        {entry.warehouseCode}
                      </Badge>
                      <span className="truncate font-medium">{entry.productName}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{entry.productCode}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isEditing ? (
                      <>
                        <Input type="date" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="h-8 w-36 text-xs" />
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
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => startEdit(entry)} aria-label={`${entry.productName} 소비기한 수정`}>
                            <Pencil className="size-3.5" />
                          </Button>
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
