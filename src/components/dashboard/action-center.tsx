'use client';

import { AlertOctagon, ArrowRight, CalendarClock, CheckCircle2, Clock, Flame, PackageOpen, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionCenterCard, ActionCenterCategory } from '@/domain/inventory/aggregation';
import type { QuickFilter, TableTab } from '@/lib/inventory-filters';

const CARD_META: Record<ActionCenterCategory, { icon: React.ElementType; tone: string; tab: TableTab; quickFilter: QuickFilter }> = {
  NEW_DANGER: { icon: AlertOctagon, tone: 'text-status-danger', tab: 'ALL', quickFilter: 'NEW_DANGER' },
  STOCKOUT_SOON: { icon: Clock, tone: 'text-status-danger', tab: 'STOCKOUT_RISK', quickFilter: 'STOCKOUT_SOON_ONLY' },
  ACCELERATING: { icon: Flame, tone: 'text-status-warning', tab: 'ACCELERATING', quickFilter: null },
  STAGNANT: { icon: PauseCircle, tone: 'text-status-stagnant', tab: 'STAGNANT', quickFilter: null },
  OVERSTOCK_CANDIDATE: { icon: PackageOpen, tone: 'text-status-stagnant', tab: 'OVERSTOCK_CANDIDATE', quickFilter: null },
  EXPIRATION_RISK: { icon: CalendarClock, tone: 'text-status-warning', tab: 'EXPIRATION_RISK', quickFilter: null },
};

// 헤드라인으로 띄울 카테고리의 우선순위. buildActionCenterCards의 배열 순서와는 별개로,
// 경영진이 가장 먼저 봐야 할 심각도 순서를 여기서 직접 정한다.
const SEVERITY_ORDER: ActionCenterCategory[] = ['NEW_DANGER', 'STOCKOUT_SOON', 'EXPIRATION_RISK', 'ACCELERATING', 'STAGNANT', 'OVERSTOCK_CANDIDATE'];

interface ActionCenterProps {
  cards: ActionCenterCard[];
  onSelect: (tab: TableTab, quickFilter: QuickFilter) => void;
}

export function ActionCenter({ cards, onSelect }: ActionCenterProps) {
  const byCategory = new Map(cards.map((c) => [c.category, c]));
  const leadCategory = SEVERITY_ORDER.find((cat) => (byCategory.get(cat)?.count ?? 0) > 0) ?? null;
  const lead = leadCategory ? byCategory.get(leadCategory) : undefined;
  const rest = cards.filter((c) => c.category !== leadCategory);

  return (
    <section className="rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-base font-semibold">오늘 확인할 재고</h2>
        <p className="hidden text-xs text-muted-foreground sm:block">항목을 누르면 전체 재고 목록에 바로 적용됩니다.</p>
      </div>

      {lead ? (
        <button
          type="button"
          onClick={() => onSelect(CARD_META[lead.category].tab, CARD_META[lead.category].quickFilter)}
          className="flex w-full flex-col gap-3 border-b border-border px-5 py-5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div className="flex shrink-0 items-baseline gap-3">
            <span className="text-4xl font-semibold tabular-nums text-status-danger">{lead.count.toLocaleString('ko-KR')}</span>
            <span className="text-sm font-medium">{lead.title}</span>
          </div>
          {lead.sampleSkus.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground sm:justify-end">
              {lead.sampleSkus.map((s) => (
                <li key={s.skuId} className="max-w-56 truncate">
                  <span className="text-foreground">{s.productName}</span> · {s.detail}
                </li>
              ))}
            </ul>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2 border-b border-border px-5 py-5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-status-normal" aria-hidden="true" />
          오늘 우선 확인이 필요한 재고가 없습니다.
        </div>
      )}

      <div className="divide-y divide-border">
        {rest.map((card) => {
          const meta = CARD_META[card.category];
          const Icon = meta.icon;
          const sample = card.sampleSkus[0];
          return (
            <button
              key={card.category}
              type="button"
              onClick={() => onSelect(meta.tab, meta.quickFilter)}
              className={cn(
                'flex w-full items-center gap-3 px-5 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40',
                card.count === 0 && 'opacity-50',
              )}
            >
              <Icon className={cn('size-4 shrink-0', meta.tone)} aria-hidden="true" />
              <span className="w-28 shrink-0 text-sm sm:w-40">{card.title}</span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{card.count.toLocaleString('ko-KR')}</span>
              {sample && <span className="hidden truncate text-xs text-muted-foreground sm:block">{sample.productName} · {sample.detail}</span>}
              <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
