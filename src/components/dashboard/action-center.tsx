'use client';

import { AlertOctagon, Clock, Flame, TrendingUp, PauseCircle, PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionCenterCard, ActionCenterCategory } from '@/server/services/inventory-analysis-service';
import type { QuickFilter, TableTab } from '@/lib/inventory-filters';

const CARD_META: Record<ActionCenterCategory, { icon: React.ElementType; tone: string; tab: TableTab; quickFilter: QuickFilter }> = {
  NEW_DANGER: { icon: AlertOctagon, tone: 'text-status-danger bg-status-danger-bg', tab: 'ALL', quickFilter: 'NEW_DANGER' },
  STOCKOUT_SOON: { icon: Clock, tone: 'text-status-danger bg-status-danger-bg', tab: 'STOCKOUT_RISK', quickFilter: 'STOCKOUT_SOON_ONLY' },
  ACCELERATING: { icon: Flame, tone: 'text-status-warning bg-status-warning-bg', tab: 'ACCELERATING', quickFilter: null },
  STOCK_INCREASE: { icon: TrendingUp, tone: 'text-status-increase bg-status-increase-bg', tab: 'STOCK_INCREASE', quickFilter: null },
  STAGNANT: { icon: PauseCircle, tone: 'text-status-stagnant bg-status-stagnant-bg', tab: 'STAGNANT', quickFilter: null },
  OVERSTOCK_CANDIDATE: { icon: PackageOpen, tone: 'text-status-stagnant bg-status-stagnant-bg', tab: 'OVERSTOCK_CANDIDATE', quickFilter: null },
};

interface ActionCenterProps {
  cards: ActionCenterCard[];
  onSelect: (tab: TableTab, quickFilter: QuickFilter) => void;
}

export function ActionCenter({ cards, onSelect }: ActionCenterProps) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_18px_50px_-38px_rgba(15,23,42,0.65)]">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Action center</p>
          <h2 className="mt-1 text-lg font-semibold">우선 확인할 재고</h2>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">항목을 누르면 전체 재고 목록에 바로 적용됩니다.</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {cards.map((card) => {
          const meta = CARD_META[card.category];
          const Icon = meta.icon;
          return (
            <button
              key={card.category}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(meta.tab, meta.quickFilter)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(meta.tab, meta.quickFilter)}
              className={cn(
                'min-h-40 cursor-pointer bg-card p-4 text-left outline-none transition-colors hover:bg-muted/45 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring',
                card.count === 0 && 'opacity-60',
              )}
            >
              <div className="pb-3">
                <div className={cn('flex size-7 items-center justify-center rounded-md', meta.tone)}>
                  <Icon className="size-4" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">{card.title}</div>
                <div className="text-2xl font-semibold tabular-nums">{card.count.toLocaleString('ko-KR')}</div>
                {card.sampleSkus.length > 0 && (
                  <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
                    {card.sampleSkus.map((s) => (
                      <li key={s.skuId} className="truncate">
                        {s.productName} <span className="text-[10px]">· {s.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
