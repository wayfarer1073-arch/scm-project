'use client';

import { AlertOctagon, Clock, Flame, TrendingUp, PauseCircle, PackageOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <section>
      <h2 className="mb-3 text-base font-semibold">오늘 확인해야 할 재고</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => {
          const meta = CARD_META[card.category];
          const Icon = meta.icon;
          return (
            <Card
              key={card.category}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(meta.tab, meta.quickFilter)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(meta.tab, meta.quickFilter)}
              className={cn('cursor-pointer transition-shadow hover:shadow-md', card.count === 0 && 'opacity-60')}
            >
              <CardHeader className="pb-1">
                <div className={cn('flex size-7 items-center justify-center rounded-md', meta.tone)}>
                  <Icon className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                <CardTitle className="font-normal text-muted-foreground">{card.title}</CardTitle>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
