import { Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
        className,
      )}
      aria-hidden="true"
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10" />
      <Warehouse className={cn('relative', iconClassName)} strokeWidth={2} />
    </span>
  );
}
