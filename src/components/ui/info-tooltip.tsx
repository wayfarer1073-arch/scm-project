'use client';

import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function InfoTooltip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex shrink-0 items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground', className)}
          aria-label="자세히 보기"
        >
          <CircleAlert className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-left">{children}</TooltipContent>
    </Tooltip>
  );
}

export { InfoTooltip };
