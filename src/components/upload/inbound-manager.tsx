'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InboundEntryRow {
  id: string;
  skuId: string;
  productCode: string;
  productName: string;
  quantity: number;
}

interface SkuSearchResult {
  skuId: string;
  productCode: string;
  productName: string;
}

/**
 * <입고 특이사항> — 재고 Excel 업로드와 별개의 독립적인 CRUD다. 스냅샷을 재업로드/교체해도
 * 자동으로 지워지지 않으며, 아래 삭제 버튼을 직접 눌러야만 없어진다. 상품은 자유 텍스트가 아니라
 * 창고 내 SKU를 검색해 드롭다운에서 선택하도록 해 오타·공백 차이로 인한 매칭 실패를 근본적으로 없앤다.
 */
export function InboundManager({ warehouseId, date }: { warehouseId: string; date: string }) {
  const [entries, setEntries] = useState<InboundEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SkuSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSku, setSelectedSku] = useState<SkuSearchResult | null>(null);
  const [quantity, setQuantity] = useState('');
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inbound?warehouseId=${encodeURIComponent(warehouseId)}&date=${encodeURIComponent(date)}`)
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((body) => {
        if (!cancelled) setEntries(body.entries ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [warehouseId, date]);

  function handleQueryChange(value: string) {
    setSelectedSku(null);
    setQuery(value);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed === '') {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/sku/search?warehouseId=${encodeURIComponent(warehouseId)}&q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((body) => setResults(body.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
  }

  async function handleAdd() {
    if (!selectedSku) return;
    const qty = Number(quantity);
    if (!Number.isSafeInteger(qty) || qty <= 0) {
      toast.error('입고 수량은 1 이상의 정수로 입력하세요.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId, skuId: selectedSku.skuId, date, quantity: qty }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? '추가에 실패했습니다.');
        return;
      }
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.skuId === body.entry.skuId);
        if (idx === -1) return [...prev, body.entry];
        const next = [...prev];
        next[idx] = body.entry;
        return next;
      });
      toast.success('입고 특이사항을 추가했습니다.');
      setSelectedSku(null);
      setQuantity('');
      setQuery('');
    } catch {
      toast.error('네트워크 오류로 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/inbound/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('삭제에 실패했습니다.');
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('입고 특이사항을 삭제했습니다.');
    } catch {
      toast.error('네트워크 오류로 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div>
        <Label>입고 특이사항</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          이 날짜까지 입고된 상품과 수량을 기록하면 추정 소진량에서 입고분을 보정합니다. Excel 업로드와 별개로 저장되며, 자료를 교체해도 지워지지
          않고 아래 삭제 버튼을 눌러야만 없어집니다.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">불러오는 중...</p>
      ) : entries.length > 0 ? (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
              <div className="min-w-0">
                <span className="font-medium">{entry.productName}</span>{' '}
                <span className="text-muted-foreground">{entry.productCode}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums">{entry.quantity.toLocaleString()}개</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`${entry.productName} 입고 특이사항 삭제`}
                  disabled={deletingId === entry.id}
                  onClick={() => handleDelete(entry.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">등록된 입고 특이사항이 없습니다.</p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-start gap-2 pt-1">
        <div className="relative">
          <Input
            aria-label="입고 상품 검색"
            placeholder="상품명 또는 상품코드로 검색"
            value={selectedSku ? `${selectedSku.productName} (${selectedSku.productCode})` : query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          />
          {showDropdown && !selectedSku && query.trim() !== '' && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
              {searching ? (
                <p className="p-2 text-xs text-muted-foreground">검색 중...</p>
              ) : results.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">일치하는 상품이 없습니다.</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.skuId}
                    type="button"
                    className="block w-full px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedSku(r);
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-medium">{r.productName}</span> <span className="text-muted-foreground">{r.productCode}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <Input
          aria-label="입고 수량"
          type="number"
          min={1}
          step={1}
          placeholder="수량"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Button type="button" variant="outline" size="sm" disabled={!selectedSku || quantity.trim() === '' || adding} onClick={handleAdd}>
          추가
        </Button>
      </div>
    </div>
  );
}
