import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground border-border',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        danger: 'border-transparent bg-status-danger-bg text-status-danger',
        warning: 'border-transparent bg-status-warning-bg text-status-warning',
        normal: 'border-transparent bg-status-normal-bg text-status-normal',
        increase: 'border-transparent bg-status-increase-bg text-status-increase',
        stagnant: 'border-transparent bg-status-stagnant-bg text-status-stagnant',
        soldout: 'border-transparent bg-status-soldout-bg text-status-soldout',
        notice: 'border-transparent bg-tag-notice-bg text-tag-notice',
        resolved: 'border-transparent bg-tag-resolved-bg text-tag-resolved',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
